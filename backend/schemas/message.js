import {z} from "zod";

export const messageSchema = z.strictObject({
    token: z.string().min(1),
    event_id: z.string().min(1),
    conversation_id: z.string().min(1),
    stay_id: z.string().min(1),
    text: z.string().min(1).max(8000),
})


export const validateMessage = (message) => {
    return messageSchema.safeParse(message);
}

export const validatePartialMessage = (message) => {
    return messageSchema.partial().safeParse(message);
}