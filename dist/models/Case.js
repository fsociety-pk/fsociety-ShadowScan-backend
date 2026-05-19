"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const CaseSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium', index: true },
    category: { type: String, required: true, index: true },
    clues: [{ type: String }],
    notes: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Closed', 'Archived'], default: 'Active', index: true },
    targetProfile: {
        name: String,
        email: String,
        phone: String,
        organization: String,
        location: String,
        socialMedia: String,
        additionalNotes: String,
    },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toolsSuggested: [{ type: String }],
    findings: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Finding', index: true }],
    reportGenerated: { type: Boolean, default: false, index: true },
    reportTemplate: { type: String, enum: ['fbi', 'corporate'], sparse: true },
    lastReportId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Report', sparse: true },
    tags: [{ type: String, index: true }],
}, { timestamps: true });
// Text index for personal investigations
CaseSchema.index({ title: 'text', description: 'text', notes: 'text' });
// Combined index for user-specific listing
CaseSchema.index({ createdBy: 1, createdAt: -1 });
exports.default = mongoose_1.default.model('Case', CaseSchema);
