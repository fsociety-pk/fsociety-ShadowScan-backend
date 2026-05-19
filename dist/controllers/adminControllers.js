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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promoteUser = exports.resetUserPassword = exports.toggleUserStatus = exports.updateUser = exports.createUser = exports.deleteUser = exports.getUserDetails = exports.getAllUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const AdminLog_1 = __importDefault(require("../models/AdminLog"));
const Case_1 = __importDefault(require("../models/Case"));
/**
 * 1. Get All Users with pagination, filtering, and sorting
 */
const getAllUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = {};
        if (req.query.isActive !== undefined)
            filter.isActive = req.query.isActive === 'true';
        if (req.query.role)
            filter.role = req.query.role;
        if (req.query.riskScore)
            filter.riskScore = { $gte: parseInt(req.query.riskScore) };
        const sortField = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortField]: sortOrder };
        const users = yield User_1.default.find(filter)
            .select('username email role createdAt lastLogin totalScans isActive riskScore points')
            .sort(sort)
            .skip(skip)
            .limit(limit);
        const total = yield User_1.default.countDocuments(filter);
        res.json({
            success: true,
            data: users,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getAllUsers = getAllUsers;
/**
 * 2. Get User Details + Activity History (Recent 10)
 */
const getUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.default.findById(req.params.id).select('-passwordHash');
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });
        // Activity history from AdminLog (tool scans performed by this user)
        const activity = yield AdminLog_1.default.find({ userId: user._id })
            .sort({ timestamp: -1 })
            .limit(10);
        // Also include cases created by user
        const cases = yield Case_1.default.find({ createdBy: user._id }).sort({ createdAt: -1 }).limit(5);
        res.json({
            success: true,
            data: {
                user,
                activity,
                cases
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getUserDetails = getUserDetails;
/**
 * 3. Delete User account and all associated data
 */
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid User ID format' });
    }
    const session = yield mongoose_1.default.startSession();
    let useTransaction = true;
    try {
        session.startTransaction();
    }
    catch (err) {
        // If startTransaction itself fails (unlikely to happen here, usually happens on first op)
        useTransaction = false;
    }
    try {
        const user = yield User_1.default.findById(id);
        if (!user) {
            if (useTransaction)
                yield session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'User not found in database' });
        }
        // Define the core deletion logic to reuse for both transaction and fallback
        const executeDeletion = (s) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Delete user cases/scans
            const caseResult = yield Case_1.default.deleteMany({ createdBy: user._id }).session(s || null);
            console.log(`[Admin] Deleted ${caseResult.deletedCount} cases for user ${user.username}`);
            // 2. Delete the user
            const deleteResult = yield User_1.default.findByIdAndDelete(user._id).session(s || null);
            if (!deleteResult) {
                throw new Error('User deletion failed during database operation');
            }
            // 3. Log action
            yield AdminLog_1.default.create([{
                    userId: req.user.id,
                    action: 'user_deleted',
                    toolName: 'AdminPanel',
                    details: { deletedUserId: user._id, username: user.username, casesDeleted: caseResult.deletedCount },
                    status: 'success',
                    timestamp: new Date()
                }], { session: s || undefined });
            return caseResult.deletedCount;
        });
        let casesDeleted = 0;
        try {
            casesDeleted = yield executeDeletion(useTransaction ? session : undefined);
            if (useTransaction)
                yield session.commitTransaction();
        }
        catch (opError) {
            // If it failed because of missing replica set, try one last time without transaction
            if (useTransaction && (opError.code === 20 || opError.message.includes('replica set member') || opError.codeName === 'IllegalOperation')) {
                console.warn('[AdminController] Transactions not supported on this MongoDB instance. Falling back to non-transactional deletion.');
                yield session.abortTransaction();
                useTransaction = false;
                // Retry without session
                casesDeleted = yield executeDeletion();
            }
            else {
                throw opError; // Re-throw if it's a "real" error
            }
        }
        res.json({ success: true, message: `Operative ${user.username} and ${casesDeleted} associated cases terminated.${!useTransaction ? ' (Standalone Mode)' : ''}` });
    }
    catch (error) {
        if (useTransaction && session.inTransaction()) {
            yield session.abortTransaction();
        }
        console.error('[AdminController] deleteUser Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Termination sequence failed due to internal server error'
        });
    }
    finally {
        session.endSession();
    }
});
exports.deleteUser = deleteUser;
/**
 * 4. Create User manually (Admin action)
 */
const createUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, password, role } = req.body;
        const userExists = yield User_1.default.findOne({ $or: [{ username }, { email }] });
        if (userExists)
            return res.status(400).json({ success: false, message: 'User already exists' });
        const salt = yield bcryptjs_1.default.genSalt(10);
        const passwordHash = yield bcryptjs_1.default.hash(password, salt);
        const user = yield User_1.default.create({
            username,
            email,
            passwordHash,
            role: role || 'user'
        });
        yield AdminLog_1.default.create({
            userId: req.user.id,
            action: 'user_created',
            toolName: 'AdminPanel',
            details: { newUserId: user._id, username: user.username, role: user.role },
            status: 'success'
        });
        res.status(201).json({ success: true, data: user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.createUser = createUser;
/**
 * 5. Update User details
 */
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, role, points, isActive } = req.body;
        const user = yield User_1.default.findByIdAndUpdate(req.params.id, { username, email, role, points, isActive }, { returnDocument: 'after' }).select('-passwordHash');
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });
        yield AdminLog_1.default.create({
            userId: req.user.id,
            action: 'admin_action',
            toolName: 'AdminPanel',
            details: { updatedUserId: user._id, changes: req.body },
            status: 'success'
        });
        res.json({ success: true, data: user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.updateUser = updateUser;
/**
 * 6. Block/Unblock User
 */
const toggleUserStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { isActive, reason } = req.body;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid User ID format' });
    }
    try {
        const user = yield User_1.default.findByIdAndUpdate(id, { isActive }, { returnDocument: 'after' }).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Verify update
        if (user.isActive !== isActive) {
            throw new Error(`Database failed to update isActive status to ${isActive}`);
        }
        yield AdminLog_1.default.create({
            userId: req.user.id,
            action: isActive ? 'admin_action' : 'user_blocked', // Using admin_action for unblock for now
            toolName: 'AdminPanel',
            details: { targetUserId: user._id, status: isActive ? 'unblocked' : 'blocked', reason },
            status: 'success'
        });
        res.json({
            success: true,
            data: user,
            message: `Status modification successful: Operative ${user.username} is now ${isActive ? 'ACTIVE' : 'DEACTIVATED'}`
        });
    }
    catch (error) {
        console.error('[AdminController] toggleUserStatus Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Status modification failed due to internal server error'
        });
    }
});
exports.toggleUserStatus = toggleUserStatus;
/**
 * 7. Reset User Password
 */
const resetUserPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Generate a temporary password (simple for demo, should be more complex/secure)
        const tempPassword = Math.random().toString(36).slice(-10);
        const salt = yield bcryptjs_1.default.genSalt(10);
        const passwordHash = yield bcryptjs_1.default.hash(tempPassword, salt);
        const user = yield User_1.default.findByIdAndUpdate(req.params.id, { passwordHash }, { returnDocument: 'after' });
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });
        yield AdminLog_1.default.create({
            userId: req.user.id,
            action: 'admin_action',
            toolName: 'AdminPanel',
            details: { action: 'password_reset', targetUserId: user._id },
            status: 'success'
        });
        res.json({
            success: true,
            message: 'Password reset successful. Temporary password generated.',
            tempPassword // In a real app, send via email instead of returning in response
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.resetUserPassword = resetUserPassword;
/**
 * 8. Promote User to Admin (Super-Admin action)
 */
const promoteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPassword } = req.body;
        const targetUserId = req.params.userId;
        const currentAdminId = req.user.id;
        // 1. Verify current admin
        const currentAdmin = yield User_1.default.findById(currentAdminId);
        if (!currentAdmin)
            return res.status(404).json({ success: false, message: 'Admin not found' });
        // 2. Validate password
        const isMatch = yield bcryptjs_1.default.compare(adminPassword, currentAdmin.passwordHash);
        if (!isMatch)
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        // 3. Update target user
        const targetUser = yield User_1.default.findByIdAndUpdate(targetUserId, { role: 'admin' }, { returnDocument: 'after' }).select('-passwordHash');
        if (!targetUser)
            return res.status(404).json({ success: false, message: 'Target user not found' });
        // 4. Log the promotion
        yield AdminLog_1.default.create({
            userId: currentAdminId,
            action: 'admin_promotion',
            toolName: 'AdminPanel',
            details: { promotedUserId: targetUser._id, username: targetUser.username },
            status: 'success'
        });
        res.json({ success: true, message: 'User successfully promoted to administrator status', data: targetUser });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.promoteUser = promoteUser;
