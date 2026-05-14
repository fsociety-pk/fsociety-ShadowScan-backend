import { Request, Response } from 'express';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key' // User will provide this in .env
});

export const handleChat = async (req: Request, res: Response) => {
    try {
        const { message, history, image_url } = req.body;

        if (!message && !image_url) {
            return res.status(400).json({ success: false, message: 'Message or image is required' });
        }

        const systemPrompt = {
            role: 'system',
            content: `You are an advanced AI OSINT (Open Source Intelligence) Assistant integrated into the ShadowScan Platform. 
Your primary goal is to guide users through intelligence gathering, explain OSINT tools (like Sherlock, TheHarvester, Nmap, ExifTool), and help interpret findings.
Maintain a professional, analytical, and cyberpunk-esque persona. Do not assist in illegal activities. Always advise users to scan authorized targets only.`
        };

        let userContent: any = message || 'Analyze this image.';
        if (image_url) {
            userContent = [
                { type: 'text', text: message || 'Please perform OSINT analysis on this image.' },
                { type: 'image_url', image_url: { url: image_url } }
            ];
        }

        const messages = [
            systemPrompt,
            ...(history || []),
            { role: 'user', content: userContent }
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages,
            model: image_url ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 1024,
        });

        const reply = chatCompletion.choices[0]?.message?.content || 'Error: Could not generate a response.';

        res.json({
            success: true,
            reply
        });
    } catch (error: any) {
        console.error('Groq Chat Error:', error?.response?.data || error.message || error);
        res.status(500).json({ 
            success: false, 
            message: error?.message || 'Failed to process chat request',
            details: error?.response?.data || null
        });
    }
};
