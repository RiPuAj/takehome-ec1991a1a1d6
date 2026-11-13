import {Router} from "express";
import { ProposalsController } from "../controllers/proposals.js";
import { authMiddleware, managerMiddleware } from "../middlewares/auth.js";
export const createProposalsRouter = () => {
    const router = Router();
    const proposalsController = new ProposalsController();

    
    router.get('/', managerMiddleware, proposalsController.getProposals);
    router.post('/:id/approve', managerMiddleware, proposalsController.approveProposal);
    router.post('/:id/reject', managerMiddleware, proposalsController.rejectProposal);
    router.post('/:id/reconcile', managerMiddleware, proposalsController.reconcileProposal);
    return router;
}