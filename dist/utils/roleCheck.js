"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSufficientPoints = exports.isActive = exports.isAdmin = void 0;
/**
 * Checks if a user has the admin role.
 * @param user The user object (from request or database)
 * @returns boolean
 */
const isAdmin = (user) => {
    return user && user.role === 'admin';
};
exports.isAdmin = isAdmin;
/**
 * Checks if a user is active (not blocked).
 * @param user The user object
 * @returns boolean
 */
const isActive = (user) => {
    return user && user.isActive === true;
};
exports.isActive = isActive;
/**
 * Validates if the user has required points (if applicable for admin actions).
 * @param user The user object
 * @param requiredPoints Points required
 * @returns boolean
 */
const hasSufficientPoints = (user, requiredPoints) => {
    return (user.points || 0) >= requiredPoints;
};
exports.hasSufficientPoints = hasSufficientPoints;
