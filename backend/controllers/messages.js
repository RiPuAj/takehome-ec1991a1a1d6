import { validateMessage } from "../schemas/message.js";
import { validateLlmInterpretation } from "../schemas/llmResponse.js";
import { AppError } from "../errors/apperr.js";

export class MessagesController{
    
    constructor({ messageModel, proposalModel, llmService }) {
        this.messageModel = messageModel;
        this.proposalModel = proposalModel;
        this.llmService = llmService;
    }

    postMessage = async (req, res) => {
        const remoteToken = req.user_remote_token;
        const body_request = {
            token: req.token_without_bearer,
            ...req.body
        }

        
        const validationResult = validateMessage(body_request);
        if (!validationResult.success) {
            return res.status(400).json({ code: 400, error: "Invalid message format" });

        }

        const { event_id, conversation_id, stay_id, text } = req.body;
        try{
            const messageExists = this.messageModel.getIfMessageExists({
                event_id,
                conversation_id,
                stay_id,
                text
            })


        } catch(err){
            const error = returnError(err)
            return res.status(error.code).json({code:error.code, error:error.message})
        }
        const llmResponse = await this.llmService.extractInformation({message: text})

        const response_content = llmResponse.choices[0].message.content
        if (!validateLlmInterpretation(response_content).success) {
            var message;
            try{
                message = this.messageModel.createMessage({
                    sender_id: token_without_bearer,
                    event_id: event_id,
                    conversation_id: conversation_id,
                    stay_id: stay_id,
                    text: text
                })

                if (message?.text === text){
                    const response = {
                        event_id: message.event_id,
                        conversation_id: message.conversation_id,
                        message: text,
                        proposal_id: message.proposal_id,
                        trace_id: message.trace_id, // Gestionar las trazas
                        replayed: true 
                    }

                    return res.status(200).json(response)
                } else {
                    return res.status(409).json({code:409, error: "Duplicate message, diferent content"}) 
                }

            } catch(err) {
                const error = returnError(err)
                return res.status(error.code).json({code:error.code, error:error.message})
            }


        }

        function returnError(err){
            if (!(err instanceof AppError)) return new AppError(400,"Error creating message", err)
                
            return err
        }


        

        res.json({ message: "Message received successfully" });
    }

    
}