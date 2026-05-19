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
const FindingSchema = new mongoose_1.Schema({
    caseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    findingType: {
        type: String,
        enum: ['email_lookup', 'username_search', 'phone_lookup', 'breach', 'metadata', 'other'],
        required: true,
        index: true,
    },
    source: { type: String, required: true, index: true },
    email: { type: String, index: true, sparse: true },
    username: { type: String, index: true, sparse: true },
    phone: { type: String, index: true, sparse: true },
    domain: { type: String, index: true, sparse: true },
    data: { type: mongoose_1.Schema.Types.Mixed, required: true },
    confidence: { type: Number, min: 0, max: 100, default: 75 },
    isVerified: { type: Boolean, default: false },
    tags: [{ type: String }],
}, { timestamps: true });
// Composite index for efficient queries
FindingSchema.index({ caseId: 1, findingType: 1 });
FindingSchema.index({ caseId: 1, createdAt: -1 });
FindingSchema.index({ email: 1, phone: 1, username: 1 });
exports.default = mongoose_1.default.model('Finding', FindingSchema);
