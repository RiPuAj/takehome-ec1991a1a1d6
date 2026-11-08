export class MessagesController{

    postMesage = async (req, res) => {
        const token = req.header.authorization;
        console.log("Token:", token);

        res.json({ message: "Message received successfully" });
    }
}