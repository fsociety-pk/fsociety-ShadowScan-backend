import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
// Ensure the secret is exactly 32 bytes for AES-256
const SECRET_KEY = crypto.scryptSync(process.env.ADMIN_PANEL_SECRET || '', 'salt', 32);

if (!process.env.ADMIN_PANEL_SECRET) {
  console.error('FATAL: ADMIN_PANEL_SECRET is not set in environment variables!');
}

export const encryptAPIKey = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptAPIKey = (hash: string): string => {
  try {
    const parts = hash.split(':');
    if (parts.length !== 2) return hash; // might not be encrypted yet
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed, returning raw string to prevent app crash');
    return hash;
  }
};
