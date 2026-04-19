import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User';
import AdminLog from '../models/AdminLog';
import Case from '../models/Case';

/**
 * 1. Get All Users with pagination, filtering, and sorting
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.role) filter.role = req.query.role;
    if (req.query.riskScore) filter.riskScore = { $gte: parseInt(req.query.riskScore as string) };

    const sortField = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortOrder };

    const users = await User.find(filter)
      .select('username email role createdAt lastLogin totalScans isActive riskScore points')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Get User Details + Activity History (Recent 10)
 */
export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Activity history from AdminLog (tool scans performed by this user)
    const activity = await AdminLog.find({ userId: user._id })
      .sort({ timestamp: -1 })
      .limit(10);

    // Also include cases created by user
    const cases = await Case.find({ createdBy: user._id }).sort({ createdAt: -1 }).limit(5);

    res.json({
      success: true,
      data: {
        user,
        activity,
        cases
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Delete User account and all associated data
 */
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid User ID format' });
  }

  const session = await mongoose.startSession();
  let useTransaction = true;

  try {
    session.startTransaction();
  } catch (err) {
    // If startTransaction itself fails (unlikely to happen here, usually happens on first op)
    useTransaction = false;
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      if (useTransaction) await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found in database' });
    }

    // Define the core deletion logic to reuse for both transaction and fallback
    const executeDeletion = async (s?: mongoose.ClientSession) => {
      // 1. Delete user cases/scans
      const caseResult = await Case.deleteMany({ createdBy: user._id }).session(s || null);
      console.log(`[Admin] Deleted ${caseResult.deletedCount} cases for user ${user.username}`);
      
      // 2. Delete the user
      const deleteResult = await User.findByIdAndDelete(user._id).session(s || null);
      if (!deleteResult) {
        throw new Error('User deletion failed during database operation');
      }

      // 3. Log action
      await AdminLog.create([{
        userId: (req as any).user.id,
        action: 'user_deleted',
        toolName: 'AdminPanel',
        details: { deletedUserId: user._id, username: user.username, casesDeleted: caseResult.deletedCount },
        status: 'success',
        timestamp: new Date()
      }], { session: s || undefined });

      return caseResult.deletedCount;
    };

    let casesDeleted = 0;
    try {
      casesDeleted = await executeDeletion(useTransaction ? session : undefined);
      if (useTransaction) await session.commitTransaction();
    } catch (opError: any) {
      // If it failed because of missing replica set, try one last time without transaction
      if (useTransaction && (opError.code === 20 || opError.message.includes('replica set member') || opError.codeName === 'IllegalOperation')) {
        console.warn('[AdminController] Transactions not supported on this MongoDB instance. Falling back to non-transactional deletion.');
        await session.abortTransaction();
        useTransaction = false;
        // Retry without session
        casesDeleted = await executeDeletion();
      } else {
        throw opError; // Re-throw if it's a "real" error
      }
    }

    res.json({ success: true, message: `Operative ${user.username} and ${casesDeleted} associated cases terminated.${!useTransaction ? ' (Standalone Mode)' : ''}` });
  } catch (error: any) {
    if (useTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('[AdminController] deleteUser Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Termination sequence failed due to internal server error' 
    });
  } finally {
    session.endSession();
  }
};

/**
 * 4. Create User manually (Admin action)
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body;

    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) return res.status(400).json({ success: false, message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      passwordHash,
      role: role || 'user'
    });

    await AdminLog.create({
      userId: (req as any).user.id,
      action: 'user_created',
      toolName: 'AdminPanel',
      details: { newUserId: user._id, username: user.username, role: user.role },
      status: 'success'
    });

    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Update User details
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { username, email, role, points, isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, role, points, isActive },
      { returnDocument: 'after' }
    ).select('-passwordHash');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await AdminLog.create({
      userId: (req as any).user.id,
      action: 'admin_action',
      toolName: 'AdminPanel',
      details: { updatedUserId: user._id, changes: req.body },
      status: 'success'
    });

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Block/Unblock User
 */
export const toggleUserStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid User ID format' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { returnDocument: 'after' }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify update
    if (user.isActive !== isActive) {
      throw new Error(`Database failed to update isActive status to ${isActive}`);
    }

    await AdminLog.create({
      userId: (req as any).user.id,
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
  } catch (error: any) {
    console.error('[AdminController] toggleUserStatus Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Status modification failed due to internal server error' 
    });
  }
};

/**
 * 7. Reset User Password
 */
export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    // Generate a temporary password (simple for demo, should be more complex/secure)
    const tempPassword = Math.random().toString(36).slice(-10);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const user = await User.findByIdAndUpdate(req.params.id, { passwordHash }, { returnDocument: 'after' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await AdminLog.create({
      userId: (req as any).user.id,
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 8. Promote User to Admin (Super-Admin action)
 */
export const promoteUser = async (req: Request, res: Response) => {
  try {
    const { adminPassword } = req.body;
    const targetUserId = req.params.userId;
    const currentAdminId = (req as any).user.id;

    // 1. Verify current admin
    const currentAdmin = await User.findById(currentAdminId);
    if (!currentAdmin) return res.status(404).json({ success: false, message: 'Admin not found' });

    // 2. Validate password
    const isMatch = await bcrypt.compare(adminPassword, currentAdmin.passwordHash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid admin credentials' });

    // 3. Update target user
    const targetUser = await User.findByIdAndUpdate(
      targetUserId,
      { role: 'admin' },
      { returnDocument: 'after' }
    ).select('-passwordHash');

    if (!targetUser) return res.status(404).json({ success: false, message: 'Target user not found' });

    // 4. Log the promotion
    await AdminLog.create({
      userId: currentAdminId,
      action: 'admin_promotion',
      toolName: 'AdminPanel',
      details: { promotedUserId: targetUser._id, username: targetUser.username },
      status: 'success'
    });

    res.json({ success: true, message: 'User successfully promoted to administrator status', data: targetUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
