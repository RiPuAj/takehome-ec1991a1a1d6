export class ConversationsController{

    getConversationById = async (req, res) => {
        const token = req.header.authorization;
        console.log("Token:", token);

        res.json({ message: "Conversation retrieved successfully" });
    }
}