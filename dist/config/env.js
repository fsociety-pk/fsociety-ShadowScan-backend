"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = void 0;
const getRequiredEnv = (key, minLength = 1) => {
    const value = process.env[key];
    if (!value || value.trim().length < minLength) {
        throw new Error(`${key} is required and must be at least ${minLength} characters long.`);
    }
    return value;
};
const getJwtSecret = () => getRequiredEnv('JWT_SECRET', 32);
exports.getJwtSecret = getJwtSecret;
