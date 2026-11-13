import {z} from "zod";
import {receiptSchema} from "./receipt.js";

const proposalStatusEnum = z.enum([`awaiting_approval`, `processing`, `pending_verification`, `completed`, `rejected`, `stale`, `failed`]);

export const proposalSchema = z.object({
    id: z.uuid(),
    stay_id: z.string().min(1),
    current_checkout_at: z.iso.datetime({ precision: 0 }),
    requested_checkout_at: z.iso.datetime({ precision: 0 }),
    fee_eur: z.number().min(0),
    policy_document_id: z.string().min(1),
    policy_version: z.number().int().min(1),
    evidence: z.object({
        document_id: z.string().min(1),
        version: z.number().int().min(1),
        quote: z.string().min(1).max(1000),
    }),
    status: proposalStatusEnum,
    operation_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
    receipt: receiptSchema.nullable(),
})


export const validateProposal = (proposal) => {
    return proposalSchema.safeParse(proposal);
}

export const validatePartialProposal = (proposal) => {
    return proposalSchema.partial().safeParse(proposal);
}
