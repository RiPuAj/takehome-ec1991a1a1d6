import fs from 'fs';
import path from 'path';

export const getAllPoliciesDocuments = () => {

    const policies = fs.readFileSync(path.join('..', 'datos', 'documentos.jsonl'), 'utf-8')
    var policies_parsed = []

    policies.split('\n').forEach((line) => {
        if (line.trim() !== '') {
            const policy = JSON.parse(line);
            policies_parsed.push(policy);
        }

    });
    return policies_parsed;
}

