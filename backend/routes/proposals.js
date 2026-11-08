import {Router} from "express";
import { ProposalsController } from "../controllers/proposals.js";

export const createProposalsRouter = () => {
    const router = Router();
    const proposalsController = new ProposalsController();

    router.get('/proposals', (req, res) => {
        res.json({ message: "List of proposals" });
    });
    router.post('/proposals', proposalsController.postProposal);
    return router;
}