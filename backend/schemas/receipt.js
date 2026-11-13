import {z} from "zod";

export const receiptSchema = z.object({
    stay_id: z.string().min(1),
    checkout_at: z.iso.datetime({ precision: 0 }),
    version: z.number().int().min(1),
    operation_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
    change_id: z.string().min(1),
})


export const validateReceipt = (receipt) => {
    return receiptSchema.safeParse(receipt);
}

export const validatePartialReceipt = (receipt) => {
    return receiptSchema.partial().safeParse(receipt);
}
