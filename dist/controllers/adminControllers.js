"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var adminControllers_exports = {};
__export(adminControllers_exports, {
  createUser: () => createUser,
  deleteUser: () => deleteUser,
  getAllUsers: () => getAllUsers,
  getUserDetails: () => getUserDetails,
  promoteUser: () => promoteUser,
  resetUserPassword: () => resetUserPassword,
  toggleUserStatus: () => toggleUserStatus,
  updateUser: () => updateUser
});
module.exports = __toCommonJS(adminControllers_exports);
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_mongoose = __toESM(require("mongoose"));
var import_User = __toESM(require("../models/User"));
var import_AdminLog = __toESM(require("../models/AdminLog"));
var import_Case = __toESM(require("../models/Case"));
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.isActive !== void 0) filter.isActive = req.query.isActive === "true";
    if (req.query.role) filter.role = req.query.role;
    if (req.query.riskScore) filter.riskScore = { $gte: parseInt(req.query.riskScore) };
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortOrder };
    const users = await import_User.default.find(filter).select("username email role createdAt lastLogin totalScans isActive riskScore points").sort(sort).skip(skip).limit(limit);
    const total = await import_User.default.countDocuments(filter);
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getUserDetails = async (req, res) => {
  try {
    const user = await import_User.default.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const activity = await import_AdminLog.default.find({ userId: user._id }).sort({ timestamp: -1 }).limit(10);
    const cases = await import_Case.default.find({ createdBy: user._id }).sort({ createdAt: -1 }).limit(5);
    res.json({
      success: true,
      data: {
        user,
        activity,
        cases
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (!import_mongoose.default.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid User ID format" });
  }
  const session = await import_mongoose.default.startSession();
  let useTransaction = true;
  try {
    session.startTransaction();
  } catch (err) {
    useTransaction = false;
  }
  try {
    const user = await import_User.default.findById(id);
    if (!user) {
      if (useTransaction) await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "User not found in database" });
    }
    const executeDeletion = async (s) => {
      const caseResult = await import_Case.default.deleteMany({ createdBy: user._id }).session(s || null);
      console.log(`[Admin] Deleted ${caseResult.deletedCount} cases for user ${user.username}`);
      const deleteResult = await import_User.default.findByIdAndDelete(user._id).session(s || null);
      if (!deleteResult) {
        throw new Error("User deletion failed during database operation");
      }
      await import_AdminLog.default.create([{
        userId: req.user.id,
        action: "user_deleted",
        toolName: "AdminPanel",
        details: { deletedUserId: user._id, username: user.username, casesDeleted: caseResult.deletedCount },
        status: "success",
        timestamp: /* @__PURE__ */ new Date()
      }], { session: s || void 0 });
      return caseResult.deletedCount;
    };
    let casesDeleted = 0;
    try {
      casesDeleted = await executeDeletion(useTransaction ? session : void 0);
      if (useTransaction) await session.commitTransaction();
    } catch (opError) {
      if (useTransaction && (opError.code === 20 || opError.message.includes("replica set member") || opError.codeName === "IllegalOperation")) {
        console.warn("[AdminController] Transactions not supported on this MongoDB instance. Falling back to non-transactional deletion.");
        await session.abortTransaction();
        useTransaction = false;
        casesDeleted = await executeDeletion();
      } else {
        throw opError;
      }
    }
    res.json({ success: true, message: `Operative ${user.username} and ${casesDeleted} associated cases terminated.${!useTransaction ? " (Standalone Mode)" : ""}` });
  } catch (error) {
    if (useTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("[AdminController] deleteUser Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Termination sequence failed due to internal server error"
    });
  } finally {
    session.endSession();
  }
};
const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const userExists = await import_User.default.findOne({ $or: [{ username }, { email }] });
    if (userExists) return res.status(400).json({ success: false, message: "User already exists" });
    const salt = await import_bcryptjs.default.genSalt(10);
    const passwordHash = await import_bcryptjs.default.hash(password, salt);
    const user = await import_User.default.create({
      username,
      email,
      passwordHash,
      role: role || "user"
    });
    await import_AdminLog.default.create({
      userId: req.user.id,
      action: "user_created",
      toolName: "AdminPanel",
      details: { newUserId: user._id, username: user.username, role: user.role },
      status: "success"
    });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const updateUser = async (req, res) => {
  try {
    const { username, email, role, points, isActive } = req.body;
    const user = await import_User.default.findByIdAndUpdate(
      req.params.id,
      { username, email, role, points, isActive },
      { returnDocument: "after" }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    await import_AdminLog.default.create({
      userId: req.user.id,
      action: "admin_action",
      toolName: "AdminPanel",
      details: { updatedUserId: user._id, changes: req.body },
      status: "success"
    });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;
  if (!import_mongoose.default.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid User ID format" });
  }
  try {
    const user = await import_User.default.findByIdAndUpdate(
      id,
      { isActive },
      { returnDocument: "after" }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.isActive !== isActive) {
      throw new Error(`Database failed to update isActive status to ${isActive}`);
    }
    await import_AdminLog.default.create({
      userId: req.user.id,
      action: isActive ? "admin_action" : "user_blocked",
      // Using admin_action for unblock for now
      toolName: "AdminPanel",
      details: { targetUserId: user._id, status: isActive ? "unblocked" : "blocked", reason },
      status: "success"
    });
    res.json({
      success: true,
      data: user,
      message: `Status modification successful: Operative ${user.username} is now ${isActive ? "ACTIVE" : "DEACTIVATED"}`
    });
  } catch (error) {
    console.error("[AdminController] toggleUserStatus Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Status modification failed due to internal server error"
    });
  }
};
const resetUserPassword = async (req, res) => {
  try {
    const tempPassword = Math.random().toString(36).slice(-10);
    const salt = await import_bcryptjs.default.genSalt(10);
    const passwordHash = await import_bcryptjs.default.hash(tempPassword, salt);
    const user = await import_User.default.findByIdAndUpdate(req.params.id, { passwordHash }, { returnDocument: "after" });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    await import_AdminLog.default.create({
      userId: req.user.id,
      action: "admin_action",
      toolName: "AdminPanel",
      details: { action: "password_reset", targetUserId: user._id },
      status: "success"
    });
    res.json({
      success: true,
      message: "Password reset successful. Temporary password generated.",
      tempPassword
      // In a real app, send via email instead of returning in response
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const promoteUser = async (req, res) => {
  try {
    const { adminPassword } = req.body;
    const targetUserId = req.params.userId;
    const currentAdminId = req.user.id;
    const currentAdmin = await import_User.default.findById(currentAdminId);
    if (!currentAdmin) return res.status(404).json({ success: false, message: "Admin not found" });
    const isMatch = await import_bcryptjs.default.compare(adminPassword, currentAdmin.passwordHash);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid admin credentials" });
    const targetUser = await import_User.default.findByIdAndUpdate(
      targetUserId,
      { role: "admin" },
      { returnDocument: "after" }
    ).select("-passwordHash");
    if (!targetUser) return res.status(404).json({ success: false, message: "Target user not found" });
    await import_AdminLog.default.create({
      userId: currentAdminId,
      action: "admin_promotion",
      toolName: "AdminPanel",
      details: { promotedUserId: targetUser._id, username: targetUser.username },
      status: "success"
    });
    res.json({ success: true, message: "User successfully promoted to administrator status", data: targetUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createUser,
  deleteUser,
  getAllUsers,
  getUserDetails,
  promoteUser,
  resetUserPassword,
  toggleUserStatus,
  updateUser
});
