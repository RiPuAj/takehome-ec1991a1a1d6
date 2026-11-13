-- ---------------------------------------------------------------------------
-- SQLite NO comprueba las claves foráneas (REFERENCES) salvo que se active en
-- cada conexión. Como este fichero se ejecuta al abrir la conexión, va aquí.
-- ---------------------------------------------------------------------------
PRAGMA foreign_keys = ON;

-- Nota sobre fechas: los CHECK usan "x IS strftime(...)" y no "x = strftime(...)".
-- Si x no es una fecha válida, strftime devuelve NULL; "x = NULL" da NULL y
-- SQLite trata un CHECK que da NULL como válido. "x IS NULL" da 0 → se rechaza.

-- ---------------------------------------------------------------------------
-- Conversaciones
-- Se ligan a su propietario, hotel y reserva al crearlas (datos del token,
-- nunca del body).
-- El estado actual de la conversación es el `status` de la última respuesta
-- del asistente en `messages` (no se guarda en dos sitios).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id              TEXT PRIMARY KEY,               -- conversation_id que envía la web
    hotel_id        TEXT NOT NULL,
    stay_id         TEXT NOT NULL,
    owner_token     TEXT NOT NULL,                  -- huésped propietario
    pending_intent  TEXT,                           -- p. ej. 'late_checkout' mientras falta la hora
    language        TEXT CHECK (language IN ('es', 'en')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_hotel ON conversations (hotel_id);

-- ---------------------------------------------------------------------------
-- Propuestas de cambio de salida
-- Guardan todo lo que cubre una aprobación: reserva, hora, importe, versión
-- de las reglas y versión de la reserva.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposals (
    id                     TEXT PRIMARY KEY,        -- UUID generado por el servidor
    conversation_id        TEXT NOT NULL REFERENCES conversations (id),
    hotel_id               TEXT NOT NULL,           -- para que cada responsable solo vea su hotel
    stay_id                TEXT NOT NULL,
    -- Estado actual. Es la columna que se usa para evitar dos ejecuciones:
    --   UPDATE proposals SET status = 'processing'
    --   WHERE id = ? AND status = 'awaiting_approval'   -- y mirar cuántas filas cambió
    -- Cada cambio se escribe también en proposal_statuses, en la misma transacción.
    status                 TEXT NOT NULL DEFAULT 'awaiting_approval'
                           CHECK (status IN ('awaiting_approval', 'processing', 'pending_verification',
                                             'completed', 'rejected', 'stale', 'failed')),
    current_checkout_at    TEXT NOT NULL                                   -- 2026-11-10T11:00:00Z
                           CHECK (current_checkout_at IS strftime('%Y-%m-%dT%H:%M:%SZ', current_checkout_at)),
    requested_checkout_at  TEXT NOT NULL                                   -- 2026-11-10T14:00:00Z
                           CHECK (requested_checkout_at IS strftime('%Y-%m-%dT%H:%M:%SZ', requested_checkout_at)),
    fee_eur                REAL NOT NULL CHECK (fee_eur >= 0),
    policy_document_id     TEXT NOT NULL,
    policy_version         INTEGER NOT NULL CHECK (policy_version >= 1),
    -- evidence { document_id, version, quote }
    evidence_document_id   TEXT NOT NULL,
    evidence_version       INTEGER NOT NULL CHECK (evidence_version >= 1),
    evidence_quote         TEXT NOT NULL CHECK (length(evidence_quote) BETWEEN 1 AND 1000),
    -- Versión de la reserva cuando se preparó: es el expected_version de POST /changes
    stay_version           INTEGER NOT NULL CHECK (stay_version >= 1),
    -- Clave estable de la operación remota. Se genera al crear la propuesta y no
    -- cambia nunca, ni tras errores ni tras reinicios.
    -- Formato del servicio de reservas: 1-80 caracteres, empieza por letra o
    -- número y después solo letras, números, '.', '_' o '-'.
    operation_key          TEXT NOT NULL UNIQUE
                           CHECK (length(operation_key) BETWEEN 1 AND 80
                                  AND operation_key GLOB '[A-Za-z0-9]*'
                                  AND operation_key NOT GLOB '*[^A-Za-z0-9._-]*'),
    -- Si esta propuesta sustituye a otra que quedó 'stale' (cambió la reserva,
    -- las reglas o la disponibilidad), aquí va el id de la antigua. La nueva
    -- lleva su propia operation_key: reutilizar la vieja con otro contenido
    -- daría 409 operation_key_conflict en el servicio de reservas.
    replaces_proposal_id   TEXT REFERENCES proposals (id),
    created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    -- Solo se propone salir MÁS TARDE. Si pide la misma hora o una anterior,
    -- se informa de su salida actual y no se crea propuesta.
    -- (Comparar texto funciona porque las dos fechas tienen el mismo formato ISO.)
    CHECK (requested_checkout_at > current_checkout_at),

    -- Necesario para que receipts pueda exigir que (proposal_id, operation_key)
    -- sean de la MISMA propuesta.
    UNIQUE (id, operation_key)
);

CREATE INDEX IF NOT EXISTS idx_proposals_hotel        ON proposals (hotel_id);
CREATE INDEX IF NOT EXISTS idx_proposals_conversation ON proposals (conversation_id);

-- ---------------------------------------------------------------------------
-- Historial de estados de la propuesta
-- Una fila por cada cambio de estado (registro de la operación).
-- La aprobación queda aquí: fila con status 'processing' y actor_token del responsable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_statuses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id  TEXT NOT NULL REFERENCES proposals (id),
    status       TEXT NOT NULL
                 CHECK (status IN ('awaiting_approval', 'processing', 'pending_verification',
                                   'completed', 'rejected', 'stale', 'failed')),
    actor_token  TEXT,                              -- quién lo provocó (manager-a, o NULL si fue el sistema)
    reason       TEXT,                              -- p. ej. 'version_conflict', 'response_lost'
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_proposal_statuses_proposal ON proposal_statuses (proposal_id, id);

-- ---------------------------------------------------------------------------
-- Recibos (confirmaciones del servicio de reservas)
-- Solo se guarda un recibo que coincide con la operación y los datos enviados
-- (stay_id, checkout_at = requested_checkout_at, version = stay_version + 1):
-- eso lo comprueba el código antes de insertar.
-- Solo entonces la propuesta puede pasar a 'completed'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receipts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id    TEXT NOT NULL UNIQUE,                                -- un recibo por propuesta
    stay_id        TEXT NOT NULL,
    checkout_at    TEXT NOT NULL                                        -- 2026-11-10T14:00:00Z
                   CHECK (checkout_at IS strftime('%Y-%m-%dT%H:%M:%SZ', checkout_at)),
    version        INTEGER NOT NULL CHECK (version >= 1),               -- versión de la reserva tras el cambio
    operation_key  TEXT NOT NULL UNIQUE,
    change_id      TEXT NOT NULL UNIQUE,                                -- chg_... del servicio
    received_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    -- La operation_key del recibo tiene que ser la de SU propuesta, no la de otra.
    FOREIGN KEY (proposal_id, operation_key) REFERENCES proposals (id, operation_key)
);

-- ---------------------------------------------------------------------------
-- Mensajes
-- Una fila por mensaje: los del huésped y las respuestas del asistente.
--
-- Huésped:    sender_id = token, event_id obligatorio, sin reply_to_id ni status.
-- Asistente:  sender_id = 'assistant', sin event_id, con reply_to_id (el mensaje
--             del huésped al que responde), status y, si hay, proposal_id y trace_id.
--
-- Replay: buscar el mensaje del huésped por (sender_id, conversation_id, event_id),
-- comparar stay_id y text, y devolver los datos de su respuesta (JOIN por
-- reply_to_id) con replayed:true. Así se conservan status, proposal_id y
-- trace_id originales aunque después hayan llegado más mensajes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations (id),
    sender_id       TEXT NOT NULL,                  -- token del huésped, o 'assistant' para las respuestas
    event_id        TEXT,                           -- solo en mensajes del huésped
    stay_id         TEXT NOT NULL,                  -- se compara para decidir si un replay es idéntico
    text            TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 8000),

    -- Solo en respuestas del asistente
    reply_to_id     INTEGER UNIQUE REFERENCES messages (id),   -- una respuesta por mensaje
    status          TEXT CHECK (status IN ('needs_input', 'information', 'awaiting_approval', 'declined', 'handoff')),
    proposal_id     TEXT REFERENCES proposals (id),
    trace_id        TEXT,

    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    -- Clave de deduplicación del contrato: (actor, conversation_id, event_id)
    UNIQUE (sender_id, conversation_id, event_id),

    -- Cada tipo de mensaje lleva solo sus campos
    CHECK (
        (sender_id <> 'assistant' AND event_id IS NOT NULL
             AND reply_to_id IS NULL AND status IS NULL AND proposal_id IS NULL)
        OR
        (sender_id = 'assistant' AND event_id IS NULL
             AND reply_to_id IS NOT NULL AND status IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, id);

-- ---------------------------------------------------------------------------
-- Registro de seguimiento (trazas)
-- Una fila por paso de una petición: llamada a la IA, consultas y cambios en
-- el servicio de reservas, validaciones... Todas las filas de una misma
-- petición comparten trace_id. Solo se muestran al responsable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS traces (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id                   TEXT NOT NULL,
    conversation_id            TEXT REFERENCES conversations (id),
    proposal_id                TEXT REFERENCES proposals (id),
    step                       TEXT NOT NULL,      -- p. ej. 'llm.interpret', 'stays.get', 'stays.availability', 'stays.change', 'operations.get'
    outcome                    TEXT NOT NULL CHECK (outcome IN ('ok', 'error')),
    http_status                INTEGER,            -- status devuelto por el servicio remoto, si lo hubo
    duration_ms                INTEGER CHECK (duration_ms >= 0),
    -- Tokens que informa la IA en `usage` (usage_simulated:true): son SIMULADOS
    simulated_prompt_tokens     INTEGER CHECK (simulated_prompt_tokens >= 0),
    simulated_completion_tokens INTEGER CHECK (simulated_completion_tokens >= 0),
    documents                  TEXT,               -- JSON con los documentos usados: [{"document_id":"...","version":2}]
    error_code                 TEXT,
    error_message              TEXT,
    created_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_traces_trace        ON traces (trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_conversation ON traces (conversation_id);
CREATE INDEX IF NOT EXISTS idx_traces_proposal     ON traces (proposal_id);
