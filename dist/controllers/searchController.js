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
exports.getCaseFindings = exports.searchFindings = exports.globalSearch = void 0;
const Case_1 = __importDefault(require("../models/Case"));
const Finding_1 = __importDefault(require("../models/Finding"));
const globalSearch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { q } = req.query;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!q) {
            return res.status(400).json({ message: 'Missing search query' });
        }
        const query = q;
        // Search cases restricted to the owner
        const cases = yield Case_1.default.find({
            $text: { $search: query },
            createdBy: userId
        }).limit(20);
        res.json({
            cases,
            entities: [] // Return empty array to maintain frontend compatibility if needed
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.globalSearch = globalSearch;
// New: Search across all findings (emails, phones, usernames, domains, etc.)
const searchFindings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { q, type, caseId, source } = req.query;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!q) {
            return res.status(400).json({ message: 'Missing search query' });
        }
        const query = q;
        const searchFilter = {};
        // Search by email, username, phone, or domain
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?[0-9\-\s\(\)]{7,}$/;
        if (emailRegex.test(query)) {
            searchFilter.email = { $regex: query, $options: 'i' };
        }
        else if (phoneRegex.test(query)) {
            searchFilter.phone = { $regex: query, $options: 'i' };
        }
        else {
            // Search in email, username, phone, domain
            searchFilter.$or = [
                { email: { $regex: query, $options: 'i' } },
                { username: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } },
                { domain: { $regex: query, $options: 'i' } },
            ];
        }
        // Add optional filters
        if (type) {
            searchFilter.findingType = type;
        }
        if (source) {
            searchFilter.source = source;
        }
        // If caseId provided, search only that case's findings
        let caseFilter = {};
        if (caseId) {
            searchFilter.caseId = caseId;
        }
        else {
            // Otherwise, find cases owned by user and get their findings
            const userCases = yield Case_1.default.find({ createdBy: userId }).select('_id');
            const caseIds = userCases.map((c) => c._id);
            searchFilter.caseId = { $in: caseIds };
        }
        // Execute search
        const findings = yield Finding_1.default.find(searchFilter)
            .populate('caseId', 'title')
            .sort({ createdAt: -1 })
            .limit(50);
        // Group findings by type
        const groupedFindings = findings.reduce((acc, finding) => {
            if (!acc[finding.findingType]) {
                acc[finding.findingType] = [];
            }
            acc[finding.findingType].push(finding);
            return acc;
        }, {});
        res.json({
            success: true,
            query,
            totalResults: findings.length,
            findings,
            grouped: groupedFindings,
            summary: {
                total: findings.length,
                byType: Object.entries(groupedFindings).reduce((acc, [type, items]) => {
                    acc[type] = items.length;
                    return acc;
                }, {}),
                bySource: findings.reduce((acc, f) => {
                    acc[f.source] = (acc[f.source] || 0) + 1;
                    return acc;
                }, {}),
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.searchFindings = searchFindings;
// Get findings for a specific case
const getCaseFindings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { caseId } = req.params;
        const { type, source } = req.query;
        const filter = { caseId };
        if (type) {
            filter.findingType = type;
        }
        if (source) {
            filter.source = source;
        }
        const findings = yield Finding_1.default.find(filter).sort({ createdAt: -1 });
        // Calculate statistics
        const stats = {
            total: findings.length,
            byType: {},
            bySource: {},
            highConfidence: findings.filter((f) => f.confidence >= 80).length,
            verified: findings.filter((f) => f.isVerified).length,
        };
        findings.forEach((f) => {
            stats.byType[f.findingType] = (stats.byType[f.findingType] || 0) + 1;
            stats.bySource[f.source] = (stats.bySource[f.source] || 0) + 1;
        });
        res.json({
            success: true,
            caseId,
            findings,
            stats,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getCaseFindings = getCaseFindings;
