import { IUser } from '../models/User';

/**
 * Checks if a user has the admin role.
 * @param user The user object (from request or database)
 * @returns boolean
 */
export const isAdmin = (user: any): boolean => {
  return user && user.role === 'admin';
};

/**
 * Checks if a user is active (not blocked).
 * @param user The user object
 * @returns boolean
 */
export const isActive = (user: IUser): boolean => {
  return user && user.isActive === true;
};

/**
 * Validates if the user has required points (if applicable for admin actions).
 * @param user The user object
 * @param requiredPoints Points required
 * @returns boolean
 */
export const hasSufficientPoints = (user: IUser, requiredPoints: number): boolean => {
  return (user.points || 0) >= requiredPoints;
};
