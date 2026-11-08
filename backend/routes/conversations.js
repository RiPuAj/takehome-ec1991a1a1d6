import { Router } from "express";
import { ConversationsController } from "../controllers/conversations.js";

export const createConversationsRouter = () => {
    const router = Router();
    const conversationsController = new ConversationsController();

    router.get('/conversations/:id', conversationsController.getConversationById);
    return router;
}