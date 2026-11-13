import { db } from './connCreater.js';

export class ProposalModel {
    static async createProposal({ proposalData }) {
        const { } = proposalData;

        const query = `
            INSERT INTO proposals (/* columns */)
            VALUES (/* values */)
        `;
        const params = [/* parameters */];

        await db.run(query, params);
    }

}