"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptAPIKey = exports.encryptAPIKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ALGORITHM = 'aes-256-cbc';
// Ensure the secret is exactly 32 bytes for AES-256
const SECRET_KEY = crypto_1.default.scryptSync(process.env.ADMIN_PANEL_SECRET || '', 'salt', 32);
if (!process.env.ADMIN_PANEL_SECRET) {
    console.error('FATAL: ADMIN_PANEL_SECRET is not set in environment variables!');
}
const encryptAPIKey = (text) => {
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};
exports.encryptAPIKey = encryptAPIKey;
const decryptAPIKey = (hash) => {
    try {
        const parts = hash.split(':');
        if (parts.length !== 2)
            return hash; // might not be encrypted yet
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        let decrypted = decipher.update(encryptedText, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        console.error('Decryption failed, returning raw string to prevent app crash');
        return hash;
    }
};
exports.decryptAPIKey = decryptAPIKey;
