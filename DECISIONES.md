# Decisiones

## 1. Persistencia en SQLite con un esquema que impide los errores graves

**Contexto.** El enunciado exige que reiniciar la aplicación conserve el trabajo y no vuelva a ejecutar un cambio. También pide que dos aprobaciones simultáneas produzcan un solo cambio, que un mensaje repetido reutilice su resultado y que nunca se dé por completado un cambio sin un recibo concordante.

**Decisión.** Usar SQLite mediante `node:sqlite`, en un fichero en disco, y llevar el máximo de reglas posible al propio esquema (`backend/models/schema.sql`) en lugar de confiar solo en el código:

- `UNIQUE (sender_id, conversation_id, event_id)` en `messages`: es la clave de deduplicación del contrato.
- `operation_key NOT NULL UNIQUE` en `proposals`, con el formato del servicio de reservas validado por `CHECK`. Se genera al crear la propuesta y no cambia nunca.
- La transición a `processing` se hace con un `UPDATE ... WHERE id = ? AND status = 'awaiting_approval'`, comprobando cuántas filas cambió. Solo una de dos aprobaciones simultáneas gana.
- `CHECK (requested_checkout_at > current_checkout_at)`: no se puede guardar una propuesta para una hora igual o anterior a la salida actual.
- La clave foránea `(proposal_id, operation_key)` en `receipts` impide asociar un recibo a otra propuesta.
- `proposal_statuses` guarda el historial de estados con el actor de cada cambio, que es donde queda registrada la aprobación.

**Alternativas.** Guardar los datos en memoria o en ficheros JSON era más rápido de empezar, pero no conserva el estado de forma fiable ni da unicidad ni transacciones. Una base de datos externa (PostgreSQL) añadía instalación y configuración sin aportar nada a una ejecución local.

**Consecuencias.** No añade dependencias, aunque exige Node 22.5 o superior y `node:sqlite` todavía es experimental. El esquema está completo, pero los modelos que lo usan no: todavía llaman a `db.run`, que no existe en `DatabaseSync`.

## 2. El contexto de la conversación lo guarda mi aplicación, ligado a la sesión

**Contexto.** El mock de IA solo interpreta el último mensaje `user` y no guarda la conversación. Aun así, el caso P01 exige que «¿Puedo salir más tarde?» seguido de «A las 14:00» acabe en una propuesta, y que otro huésped no herede ese contexto.

**Decisión.**

- La conversación se crea la primera vez que llega su `conversation_id`. Se liga al propietario, hotel y reserva **de la sesión autenticada**, nunca a datos del body. Si otra sesión usa ese id, recibe 404 sin ver nada.
- Cuando falta la hora, se guarda `pending_intent = 'late_checkout'` (y el idioma) en `conversations` y se responde `needs_input`. En el siguiente mensaje, la intención sale de la base de datos y la hora, del mensaje nuevo. `pending_intent` se limpia cuando la petición se resuelve.

**Alternativas.** Enviar todo el historial a la IA y confiar en que lo combine. Con el mock no funciona, y con un modelo real dejaría una regla de negocio en manos del modelo.

**Consecuencias.** El comportamiento no depende de la IA y el aislamiento entre huéspedes es un efecto directo del propietario de la conversación. Está diseñado en el esquema, pero no implementado.

## 3. La IA y los documentos son datos que se validan, nunca fuentes de permisos

**Contexto.** La IA puede devolver JSON roto, horas imposibles (`29:90`) o campos de privilegio (`approved`, `role`, `fee`, `hotel_id`). El corpus de documentos incluye una web que contradice la política, una versión retirada y una nota con instrucciones maliciosas.

**Decisión.**

- **Validar la IA en dos capas con Zod.** Primero el sobre de `chat/completions` (con al menos un `choice`), después `JSON.parse` del `content` y su contenido. Solo quedan `intent`, `requested_time` (`HH:MM` real o `null`) e `language`. Uso `z.object`, que descarta los campos extra, en lugar de `z.strictObject`, que rechazaría la salida. Así una petición legítima con campos basura sigue adelante, y los campos nunca llegan a la lógica.
- **Una salida inválida** → `200` con `needs_input` y sin propuesta. **Un 503** → reintento limitado respetando `Retry-After`. Si se agotan los reintentos → `503` sin marcar el evento como procesado, para poder reintentar con el mismo `event_id`.
- **Las políticas se filtran por metadatos:** hotel de la sesión, `active`, `audience = guest`, `authority = approved_policy` y la versión más alta. Si dos de esa versión discrepan → `handoff`. Las decisiones salen del campo estructurado `policy`, y `content` solo sirve para la cita literal de `evidence`. El texto de los documentos nunca se envía a la IA.
- El rol, el hotel, la reserva, el importe y la aprobación los decide siempre el servidor.

**Alternativas.** Pedir a la IA que leyera las políticas y calculara el importe: da más flexibilidad, pero abre la puerta a la inyección del documento `coral-alba-note` y a importes incorrectos.

**Consecuencias.** Los esquemas de Zod están escritos; las funciones que los aplican y la selección de políticas, no.

## Ayuda de IA utilizada

He usado **Claude** y **ChatGPT** como tutores, no como generadores de código:

- Para entender el enunciado y los contratos: qué hace cada endpoint, cuándo se crea una propuesta y con qué datos, qué rol puede usar cada ruta.
- Para que me indicaran los pasos que debía tener en cuenta (selección de políticas, orden del flujo de mensajes, manejo de fallos de la IA, contexto de la conversación) sin escribirme la implementación.
- Para revisar mi código y señalar errores. Los dos fallos de abajo salieron de esas revisiones.
- Excepción: los esquemas de Zod de `backend/schemas/llmResponse.js` siguen la propuesta que me dio Claude cuando se los pedí explícitamente.
- Con ayuda de la IA he redactado también este documento y el `README.md`, a partir de lo que le expliqué.

Tomé esta decisión porque la prueba sirve para mostrar mi forma de plantear la arquitectura y las soluciones. Ha sido una de las causas de que la entrega esté poco avanzada.

## Fallos reproducidos y corregidos

Los dos fallos están en el middleware de autenticación (`backend/middlewares/auth.js`). Los encontré revisando el código, **no** con un test automático: no hay tests en la entrega. Después de corregirlos, he comprobado el resultado arrancando el servidor y lanzando peticiones con `curl`.

### Fallo 1: el middleware seguía al controlador después de rechazar la petición

**Síntoma.** La función interna respondía `401` o `403`, pero el middleware llamaba a `next()` igualmente. Una petición sin token o con el rol equivocado llegaba al controlador, y Express intentaba responder dos veces («Cannot set headers after they are sent»). Era un acceso sin autorización.

**Corrección.** La comprobación lanza un error, el middleware lo captura con `try/catch` y hace `return res.status(...)`. `next()` solo se ejecuta si no ha habido error.

**Comprobación:**

```bash
curl -i http://localhost:3000/api/proposals
# → 401, y la petición no llega al controlador
```

### Fallo 2: la comprobación de rol separaba el token por `_` en vez de por `-`

**Síntoma.** Los tokens del kit son `guest-a1`, `manager-a`… con guion. `"manager-a".split("_")[0]` devuelve `"manager-a"`, que nunca es igual a `"manager"`, así que **todas** las rutas con rol rechazaban también a los usuarios legítimos.

**Corrección.** Separar por `-`: `token.split("-")[0]`.

**Comprobación:**

```bash
curl -i -H "Authorization: Bearer manager-a" http://localhost:3000/api/proposals
# → 200 (respuesta de ejemplo: el controlador aún no está implementado)
```

### Fallo reproducido y todavía sin corregir

Al comprobar el fallo 2 he visto que los rechazos devuelven un código incorrecto:

| Petición | Esperado | Obtenido |
| --- | --- | --- |
| `GET /api/proposals` con `guest-a1` | 403 | 400 |
| `POST /api/messages` con `manager-a` | 403 | 400 |
| Token inexistente | 401 | 400 |

**Causa.** El rechazo de rol se lanza con `throw error(...)`, donde `error` viene de `node:console`: imprime el objeto y devuelve `undefined`, así que se lanza `undefined`. El token inexistente se lanza con `AppError(...)` sin `new`, lo que provoca un `TypeError`. En los dos casos el `catch` no recibe un `AppError` y responde 400.

**Corrección pendiente.** `throw new AppError(403, ...)` y `throw new AppError(401, ...)`, respetando el orden de argumentos del constructor `(code, publicError, error)`, y responder con el formato del contrato `{ "error": { "code", "message" } }`. La rama de rechazo sigue denegando el acceso, pero con un código que no cumple el contrato.
