import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
].filter((model): model is string => Boolean(model));

export const generateAIReport = async (systemPrompt: string, caseData: any, findingsData: any): Promise<string> => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    const promptText = `SYSTEM PROMPT:\n${systemPrompt}\n\nDATA:\n${JSON.stringify({ caseData, findingsData })}`;

    let lastError: unknown;
    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: promptText }] }
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 8192,
                }
            });

            const responseText = result.response.text();
            if (responseText) {
                return responseText;
            }
            lastError = new Error(`Empty response from Gemini model ${modelName}`);
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            if (!/404|not found|unsupported/i.test(message)) {
                throw error;
            }
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error('Failed to generate intelligence report from AI engine.');
};
