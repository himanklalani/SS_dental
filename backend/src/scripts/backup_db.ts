import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import Appointment from '../models/Appointment';
import Business from '../models/Business';
import Customer from '../models/Customer';
import Doctor from '../models/Doctor';
import Message from '../models/Message';
import Patient from '../models/Patient';

dotenv.config();

async function runBackup() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error('MONGO_URI is missing in .env');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected successfully.');

        console.log('Fetching all collections...');
        const appointments = await Appointment.find({}).lean();
        const businesses = await Business.find({}).lean();
        const customers = await Customer.find({}).lean();
        const doctors = await Doctor.find({}).lean();
        const messages = await Message.find({}).lean();
        const patients = await Patient.find({}).lean();

        const backupData = {
            appointments,
            businesses,
            customers,
            doctors,
            messages,
            patients,
            exportedAt: new Date().toISOString(),
        };

        const backupPath = path.join(__dirname, '../../database_backup.json');
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

        console.log(`\n🎉 Backup successfully saved to: ${backupPath}`);
        console.log(`----------------------------------------`);
        console.log(`- Patients:     ${patients.length}`);
        console.log(`- Appointments: ${appointments.length}`);
        console.log(`- Doctors:      ${doctors.length}`);
        console.log(`- Businesses:   ${businesses.length}`);
        console.log(`- Messages:     ${messages.length}`);
        console.log(`- Customers:    ${customers.length}`);
        console.log(`----------------------------------------\n`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Backup failed:', err);
        process.exit(1);
    }
}

runBackup();
