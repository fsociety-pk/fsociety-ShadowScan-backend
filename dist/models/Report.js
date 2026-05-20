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
const ReportSchema = new mongoose_1.Schema({
    caseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    template: { type: String, enum: ['fbi', 'corporate'], required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    summary: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    entities: [
        {
            type: { type: String, enum: ['email', 'phone', 'username', 'domain', 'person', 'organization', 'ip', 'location'] },
            value: String,
            confidence: { type: Number, min: 0, max: 100 },
        },
    ],
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    findings_count: { type: Number, default: 0 },
    visualReport: { type: mongoose_1.Schema.Types.Mixed, default: null },
    syntheticDataUsed: { type: Boolean, default: false },
}, { timestamps: true });
ReportSchema.index({ caseId: 1, createdAt: -1 });
ReportSchema.index({ generatedBy: 1, createdAt: -1 });
exports.default = mongoose_1.default.model('Report', ReportSchema);
