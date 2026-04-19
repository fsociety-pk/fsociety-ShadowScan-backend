import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User';
import connectDB from '../config/db';

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = 'admin@shadowscan.local';
    const newUsername = 'spyhunter';
    const newPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!';
    
    if (!process.env.INITIAL_ADMIN_PASSWORD) {
      console.warn('⚠️ WARNING: INITIAL_ADMIN_PASSWORD not set in .env. Using default insecure password.');
    }

    // Find any existing admin user (either by old username or admin email)
    let adminUser = await User.findOne({ 
      $or: [
        { username: 'admin' }, 
        { username: newUsername }, 
        { email: adminEmail }
      ] 
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    if (adminUser) {
      console.log('Updating existing admin user credentials...');
      adminUser.username = newUsername;
      adminUser.passwordHash = passwordHash;
      adminUser.role = 'admin';
      adminUser.isActive = true;
      await adminUser.save();
      console.log('✅ Admin credentials updated successfully!');
    } else {
      console.log('Creating new admin user...');
      await User.create({
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
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
