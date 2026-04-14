import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Business from './models/Business';
import Doctor from './models/Doctor';
import Patient from './models/Patient';
import Appointment from './models/Appointment';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/review-agent');
    console.log('Connected to MongoDB');

    // Get Business
    const business = await Business.findById('65f1a2b3c4d5e6f7a8b9c0d1');
    if (!business) {
        console.log('Run basic seed first!');
        process.exit(1);
    }
    const business_id = business._id;

    // Seed Doctors
    const doctorCount = await Doctor.countDocuments();
    if (doctorCount === 0) {
        const doctors = [
            { business_id, name: 'John Smith', specialization: 'General Dentist', active: true },
            { business_id, name: 'Sarah Lee', specialization: 'Orthodontist', active: true },
            { business_id, name: 'Mike Chen', specialization: 'Oral Surgeon', active: true },
        ];
        await Doctor.insertMany(doctors);
        console.log('Doctors seeded');
    }

    // Seed Patients
    const patientCount = await Patient.countDocuments();
    if (patientCount === 0) {
        const patients = [
            {
                business_id,
                name: 'Alice Johnson',
                phone: '+1234567890',
                email: 'alice@example.com',
                date_of_birth: new Date('1990-05-15'),
                gender: 'Female',
                medical_history: ['None'],
                status: 'Active',
                tags: ['General', 'Hygiene']
            },
            {
                business_id,
                name: 'Bob Williams',
                phone: '+1987654321',
                email: 'bob@example.com',
                date_of_birth: new Date('1985-08-20'),
                gender: 'Male',
                medical_history: ['Hypertension'],
                status: 'New',
                tags: ['Ortho', 'Invisalign']
            }
        ];
        await Patient.insertMany(patients);
        console.log('Patients seeded');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding CRM:', error);
    process.exit(1);
  }
};

seed();
