import {Router} from "express";
import { MessagesController } from "../controllers/messages.js";
import { guestMiddleware } from "../middlewares/auth.js";

export const createMessagesRouter = ({ messageModel, proposalModel, llmService }) => {
    const router = Router();
    const messagesController = new MessagesController({ messageModel, proposalModel, llmService });

    router.post('/', guestMiddleware, messagesController.postMessage);
    return router;
}