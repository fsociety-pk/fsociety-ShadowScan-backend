import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export const rateLimiter = (limit: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.get('x-forwarded-for') || 'unknown';
    const currentTime = Date.now();

    if (!store[ip] || currentTime > store[ip].resetTime) {
      store[ip] = {
        count: 1,
        resetTime: currentTime + windowMs,
      };
      return next();
    }

    store[ip].count++;

    if (store[ip].count > limit) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
      });
    }

    next();
  };
};
