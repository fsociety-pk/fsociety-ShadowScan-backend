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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = __importDefault(require("../models/User"));
const db_1 = __importDefault(require("../config/db"));
dotenv_1.default.config();
const seedAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        const adminEmail = 'admin@shadowscan.local';
        const newUsername = 'spyhunter';
        const newPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!';
        if (!process.env.INITIAL_ADMIN_PASSWORD) {
            console.warn('⚠️ WARNING: INITIAL_ADMIN_PASSWORD not set in .env. Using default insecure password.');
        }
        // Find any existing admin user (either by old username or admin email)
        let adminUser = yield User_1.default.findOne({
            $or: [
                { username: 'admin' },
                { username: newUsername },
                { email: adminEmail }
            ]
        });
        const salt = yield bcryptjs_1.default.genSalt(10);
        const passwordHash = yield bcryptjs_1.default.hash(newPassword, salt);
        if (adminUser) {
            console.log('Updating existing admin user credentials...');
            adminUser.username = newUsername;
            adminUser.passwordHash = passwordHash;
            adminUser.role = 'admin';
            adminUser.isActive = true;
            yield adminUser.save();
            console.log('✅ Admin credentials updated successfully!');
        }
        else {
            console.log('Creating new admin user...');
            yield User_1.default.create({
                username: newUsername,
                email: adminEmail,
                passwordHash,
                role: 'admin',
                points: 1000,
                totalScans: 0,
                isActive: true
            });
            console.log('✅ Admin user created successfully!');
        }
        console.log(`Username: ${newUsername}`);
        console.log(`Password: ${newPassword}`);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error seeding admin:', error);
        process.exit(1);
    }
});
seedAdmin();
