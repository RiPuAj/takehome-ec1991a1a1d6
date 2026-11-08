export class ProposalsController{

    postProposal = async (req, res) => {
        const token = req.header.authorization;
        console.log("Token:", token);

        res.json({ message: "Proposal received successfully" });
    }

    getProposals = async (req, res) => {
        const token = req.header.authorization;
        console.log("Token:", token);
        res.json({ message: "List of proposals" });
    }

    approveProposal = async (req, res) => {
        const token = req.header.authorization;
        console.log("Token:", token);
        res.json({ message: "Proposal approved successfully" });
    }

    rejectProposal = async (req, res) => {
        const token = req.header.authorization;
        console.log("Token:", token);
        res.json({ message: "Proposal rejected successfully" });
    }

    reconcileProposal = async (req, res) => {
        const token = req.header.authorization;
        console.log("Token:", token);
        res.json({ message: "Proposal reconciled successfully" });
    }
}