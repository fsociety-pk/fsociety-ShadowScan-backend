import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const generateAIReport = async (systemPrompt: string, caseData: any, findingsData: any): Promise<string> => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent({
        contents: [
            { role: 'user', parts: [{ text: `SYSTEM PROMPT:\n${systemPrompt}\n\nDATA:\n${JSON.stringify({ caseData, findingsData })}` }] }
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
        }
    });

    const responseText = result.response.text();
    if (!responseText) {
        throw new Error('Failed to generate intelligence report from AI engine.');
    }
    return responseText;
};
