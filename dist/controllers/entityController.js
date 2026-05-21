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
exports.deleteEntity = exports.createEntity = exports.getEntitiesByCase = void 0;
const Entity_1 = __importDefault(require("../models/Entity"));
const getEntitiesByCase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const entities = yield Entity_1.default.find({
            relatedCase: req.params.caseId,
            createdBy: userId
        });
        res.json(entities);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getEntitiesByCase = getEntitiesByCase;
const createEntity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { type, value, relatedCase, metadata } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const entity = yield Entity_1.default.create({
            type,
            value,
            relatedCase,
            createdBy: userId,
            metadata: metadata || {}
        });
        res.status(201).json(entity);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.createEntity = createEntity;
const deleteEntity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const deletedEntity = yield Entity_1.default.findOneAndDelete({
            _id: req.params.id,
            createdBy: userId
        });
        if (!deletedEntity) {
            return res.status(404).json({ message: 'Entity not found or access denied.' });
        }
        res.json({ message: 'Entity removed successfully.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.deleteEntity = deleteEntity;
