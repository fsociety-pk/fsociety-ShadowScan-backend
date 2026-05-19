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
exports.deleteCase = exports.updateCase = exports.createCase = exports.getCaseById = exports.getCases = void 0;
const Case_1 = __importDefault(require("../models/Case"));
const getCases = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        // Strictly filter by the owner (createdBy)
        const cases = yield Case_1.default.find({ createdBy: userId }).sort({ createdAt: -1 });
        res.json(cases);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getCases = getCases;
const getCaseById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const investigation = yield Case_1.default.findOne({ _id: req.params.id, createdBy: userId });
        if (!investigation) {
            return res.status(404).json({ message: 'Investigation case not found or access denied.' });
        }
        res.json(investigation);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getCaseById = getCaseById;
const createCase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { title, description, rawFindings, category, priority, clues, toolsSuggested, notes, targetProfile, images } = req.body;
        const normalizedDescription = typeof description === 'string' && description.trim()
            ? description.trim()
            : typeof rawFindings === 'string'
                ? rawFindings.trim()
                : '';
        if (!title || !category || !normalizedDescription) {
            return res.status(400).json({
                message: 'title, category, and description/rawFindings are required.'
            });
        }
        const inferredClues = Array.isArray(clues)
            ? clues
            : typeof rawFindings === 'string'
                ? rawFindings
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                : [];
        const imageSummary = Array.isArray(images) && images.length > 0
            ? `\n\nAttached images:\n${images
                .map((img, index) => `- ${img.label || img.fileName || `image-${index + 1}`}`)
                .join('\n')}`
            : '';
        const newCase = yield Case_1.default.create({
            title,
            description: normalizedDescription,
            category,
            priority,
            clues: inferredClues,
            notes: `${notes || ''}${imageSummary}`.trim(),
            createdBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
            toolsSuggested: toolsSuggested || [],
            targetProfile: targetProfile || {},
            status: 'Active'
        });
        res.status(201).json({ message: 'Investigation case created', id: newCase._id });
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.name) === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
});
exports.createCase = createCase;
const updateCase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const updatedCase = yield Case_1.default.findOneAndUpdate({ _id: req.params.id, createdBy: userId }, req.body, { returnDocument: 'after' });
        if (!updatedCase) {
            return res.status(404).json({ message: 'Investigation case not found or access denied.' });
        }
        res.json(updatedCase);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateCase = updateCase;
const deleteCase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const deletedCase = yield Case_1.default.findOneAndDelete({ _id: req.params.id, createdBy: userId });
        if (!deletedCase) {
            return res.status(404).json({ message: 'Investigation case not found or access denied.' });
        }
        res.json({ message: 'Investigation case archived/deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.deleteCase = deleteCase;
