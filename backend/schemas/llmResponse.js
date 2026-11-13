import { z } from "zod";

// Capa 1: el sobre que devuelve POST /chat/completions
// z.object (no strict): el servicio manda más campos (id, model, created...) que no controlas
export const chatCompletionSchema = z.object({
    choices: z.array(
        z.object({
            message: z.object({
                content: z.string(),
            }),
        })
    ).min(1),
    usage: z.object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
    }).optional(),
});

// Capa 2: el JSON que viene DENTRO de choices[0].message.content
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;   // 00:00–23:59 → "29:90" no pasa

export const llmInterpretationSchema = z.object({
    intent: z.literal("late_checkout"),
    requested_time: z.string().regex(HHMM).nullable(),
    language: z.enum(["es", "en"]),
});

export const validateChatCompletions = (message) => {
    return messageSchema.safeParse(message);
}

export const validateLlmInterpretation = (message) => {
    return messageSchema.partial().safeParse(message);
}