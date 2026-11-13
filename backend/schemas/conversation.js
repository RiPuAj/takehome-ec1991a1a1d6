import {z} from "zod";
import {messageSchema} from "./message.js";

export const conversationSchema = z.object({
    status: z.enum([`needs_input`, `information`, `awaiting_approval`, `declined`, `handoff`]),
    messages: z.array(messageSchema).min(1).max(1000),
})


export const validateConversation = (conversation) => {
    return conversationSchema.safeParse(conversation);
}

export const validatePartialConversation = (conversation) => {
    return conversationSchema.partial().safeParse(conversation);
}