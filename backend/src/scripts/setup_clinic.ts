import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import Business from '../models/Business';
import Doctor from '../models/Doctor';

dotenv.config();

async function setup() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/google-review-agent');
        console.log('Connected to MongoDB');

        // Allow users to pass these via env variables
        const businessName = process.env.BUSINESS_NAME || 'My Dental Clinic';
        // If a specific ID is provided, use it. Otherwise, generate a new one.
        const businessId = process.env.BUSINESS_ID ? new mongoose.Types.ObjectId(process.env.BUSINESS_ID) : new mongoose.Types.ObjectId();
        
        // If an API key is provided in env, use it. Otherwise, generate a secure random one.
        const apiKey = process.env.CLINIC_API_KEY || crypto.randomBytes(20).toString('hex');

        // 1. Setup Business
        const business = await Business.findOneAndUpdate(
            { _id: businessId },
            {
                name: businessName,
                google_review_url: process.env.GOOGLE_REVIEW_URL || 'https://g.page/r/example/review',
                industry_type: 'dental',
                message_templates: [],
                api_key: apiKey,
            },
            { upsert: true, new: true }
        );

        console.log(`\n✅ Business Setup Complete!`);
        console.log(`----------------------------------------`);
        console.log(`BUSINESS_NAME: ${business.name}`);
        console.log(`BUSINESS_ID:   ${business._id.toString()}`);
        console.log(`API_KEY:       ${business.api_key}`);
        console.log(`----------------------------------------`);
        console.log(`⚠️ Copy these values and put them in your Vercel/Render Environment Variables!\n`);

        // 2. Setup Default Doctor (so appointments can be booked)
        await Doctor.findOneAndUpdate(
            { business_id: business._id, name: 'Default Doctor' },
            {
                specialization: 'Dentistry',
                phone: '0000000000',
                active: true
            },
            { upsert: true, new: true }
        );
        console.log('✓ Default Doctor created/updated.');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

setup();
