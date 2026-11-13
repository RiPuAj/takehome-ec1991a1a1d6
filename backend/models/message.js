import { db } from './connCreater.js';


export class MessageModel {
    static async createMessage({messageData}) {
        const { sender_id, event_id, conversation_id, stay_id, text } = messageData;
         
        const query = `
            INSERT INTO messages (sender_id, event_id, conversation_id, stay_id, text)
            VALUES (?, ?, ?, ?, ?)
        `;
        const params = [sender_id, event_id, conversation_id, stay_id, text];

        await db.run(query, params);
    }

    static async getIfMessageExists({messageData}){
        const {sender_id, event_id, conversation_id, stay_id} = messageData

        /*const query = `SELECT EXISTS (
            SELECT 1
            FROM messages
            WHERE event_id = ?
                AND conversation_id = ?
                AND stay_id = ?
                AND text = ?
            ) AS exists_message
        `*/

        const query = `
            SELECT *
            FROM messages
            WHERE event_id = ?
                AND sender_id = ?
                AND conversation_id = ?
                AND stay_id = ?
            AS message
        `

        const result = await db.run(query, [
            sender_id,
            event_id, 
            conversation_id, 
            stay_id
        ]);
        
        return result.message;
    }

}