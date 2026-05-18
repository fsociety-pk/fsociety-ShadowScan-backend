const getRequiredEnv = (key: string, minLength = 1): string => {
  const value = process.env[key];

  if (!value || value.trim().length < minLength) {
    throw new Error(`${key} is required and must be at least ${minLength} characters long.`);
  }

  return value;
};

export const getJwtSecret = (): string => getRequiredEnv('JWT_SECRET', 32);
