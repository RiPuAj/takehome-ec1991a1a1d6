export class LLMService {

    extractInformation = async ({ message }) => {
        const llmResponse = await fetch(process.env.LLM_BASE_URL + "/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
                "User-Agent": 'WorkFactory-Technical-Test/1.0'
            },
            body: JSON.stringify({
                model: process.env.LLM_MODEL,
                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ]
            })
        }).then(response => response.json());

        

        return llmResponse;

    }
}