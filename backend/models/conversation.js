import { db } from './connCreater.js';


export class ConversationModel {
    static async createConversation({conversationData}) {
        const { owner_token, stay_id, hotel_id, text } = messageData;
         
        const query = `
            INSERT INTO messages (sender_id, event_id, conversation_id, stay_id, text)
            VALUES (?, ?, ?, ?, ?)
        `;
        const params = [sender_id, event_id, conversation_id, stay_id, text];

        await db.run(query, params);
    }

    static async createConversationID(){
        const prefix = "CONV-"
        const query = `
            SELECT COUNT(*) AS conversations_length FROM conversations;
        `

        const conversations_length = await db.run(query).get().conversations_length;
        console.log(conversations_length)
        return prefix+conversations_length
        
    }

}