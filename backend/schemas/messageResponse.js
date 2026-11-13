import {z} from "zod";

export const messageResponseSchema = z.object({
    event_id: z.string().min(1),
    conversation_id: z.string().min(1),
    status: z.enum([`needs_input`, `information`, `awaiting_approval`, `declined`, `handoff`]),
    message: z.string().min(1).max(8000),
    proposal_id: z.uuid().nullable(),
    trace_id: z.uuid(),
    replayed: z.boolean(),
})


export const validateMessageResponse = (messageResponse) => {
    return messageResponseSchema.safeParse(messageResponse);
}

export const validatePartialMessageResponse = (messageResponse) => {
    return messageResponseSchema.partial().safeParse(messageResponse);
}