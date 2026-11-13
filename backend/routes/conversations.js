import { Router } from "express";
import { ConversationsController } from "../controllers/conversations.js";
import { authMiddleware } from "../middlewares/auth.js";

export const createConversationsRouter = () => {
    const router = Router();
    const conversationsController = new ConversationsController();

    router.get('/:id', authMiddleware, conversationsController.getConversationById);
    return router;
}