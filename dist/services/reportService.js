"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIReport = void 0;
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
].filter((model) => Boolean(model));
const generateAIReport = (systemPrompt, caseData, findingsData) => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    const promptText = `SYSTEM PROMPT:\n${systemPrompt}\n\nDATA:\n${JSON.stringify({ caseData, findingsData })}`;
    let lastError;
    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = yield model.generateContent({
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
        }
        catch (error) {
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
});
exports.generateAIReport = generateAIReport;
