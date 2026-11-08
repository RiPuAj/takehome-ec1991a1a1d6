import {Router} from "express";
import { MessagesController } from "../controllers/messages.js";

export const createMessagesRouter = () => {
    const router = Router();
    const messagesController = new MessagesController();

    router.post('/messages', messagesController.postMesage);
    return router;
}