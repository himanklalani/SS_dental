import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Business from '../models/Business';
import Patient from '../models/Patient';
import Appointment from '../models/Appointment';
import Doctor from '../models/Doctor';
import crypto from 'crypto';

dotenv.config();

// This MUST match the hardcoded businessId in the frontend pages
const BUSINESS_ID = new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/google-review-agent');
    console.log('Connected to MongoDB');

    // Cleanup old seed data
    await Business.deleteOne({ _id: BUSINESS_ID });
    await Patient.deleteMany({ business_id: BUSINESS_ID });
    await Appointment.deleteMany({ business_id: BUSINESS_ID });
    await Doctor.deleteMany({ business_id: BUSINESS_ID });

    // 1. Create Business
    const business = await Business.create({
        _id: BUSINESS_ID,
        name: 'Saachi Shingrani Clinic',
        google_review_url: 'https://www.google.com/search?sca_esv=55e9f3c856495c1e&q=Dr.+Saachi+Shingrani%27s+Reviews',
        industry_type: 'dental',
        message_templates: [],
        api_key: crypto.randomBytes(20).toString('hex'),
    });
    console.log('✓ Business created:', business.name);

    // 2. Create Doctor
    const doctor = await Doctor.create({
        business_id: BUSINESS_ID,
        name: 'Dr. Saachi Shingrani',
        specialization: 'Dentistry',
        phone: '9876543210',
    });
    console.log('✓ Doctor created:', doctor.name);

    // 3. Create Patients
    const patientsData = [
        { name: 'priya sharma', phone: '919876543001', email: 'priya@email.com', gender: 'Female', preferred_contact: 'WhatsApp', status: 'Active', tags: ['vip'], medical_history: ['Diabetes'], allergies: ['Penicillin'] },
        { name: 'rahul mehta', phone: '919876543002', email: 'rahul@email.com', gender: 'Male', preferred_contact: 'WhatsApp', status: 'Active', tags: [], medical_history: [], allergies: [] },
        { name: 'sneha patel', phone: '919876543003', email: 'sneha@email.com', gender: 'Female', preferred_contact: 'WhatsApp', status: 'New', tags: ['new patient'], medical_history: ['Hypertension'], allergies: [] },
        { name: 'amit verma', phone: '919876543004', email: 'amit@email.com', gender: 'Male', preferred_contact: 'WhatsApp', status: 'Active', tags: [], medical_history: [], allergies: ['Aspirin'] },
        { name: 'kavita joshi', phone: '919876543005', email: 'kavita@email.com', gender: 'Female', preferred_contact: 'WhatsApp', status: 'Inactive', tags: [], medical_history: [], allergies: [] },
        { name: 'deepak singh', phone: '919876543006', email: 'deepak@email.com', gender: 'Male', preferred_contact: 'WhatsApp', status: 'Active', tags: ['follow-up'], medical_history: ['Thyroid'], allergies: [] },
    ];

    const patients = await Patient.insertMany(patientsData.map(p => ({ ...p, business_id: BUSINESS_ID })));
    console.log(`✓ ${patients.length} patients created`);

    // 4. Create Appointments
    const now = new Date();
    const appointmentsData = [
        {
            patient_id: patients[0]._id, doctor_id: doctor._id, business_id: BUSINESS_ID,
            appointment_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // +3 days 10am
            service_type: 'Root Canal', status: 'Confirmed', preferred_slot: 'Morning', duration_minutes: 45,
            review_requested: false, review_link_clicked: false, review_received: false,
        },
        {
            patient_id: patients[1]._id, doctor_id: doctor._id, business_id: BUSINESS_ID,
            appointment_date: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // Tomorrow 2pm
            service_type: 'Teeth Cleaning', status: 'Booked', preferred_slot: 'Afternoon', duration_minutes: 30,
            review_requested: false, review_link_clicked: false, review_received: false,
        },
        {
            patient_id: patients[2]._id, doctor_id: doctor._id, business_id: BUSINESS_ID,
            appointment_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // -2 days 9am (completed)
            service_type: 'Cavity Filling', status: 'Completed', preferred_slot: 'Morning', duration_minutes: 30,
            review_requested: true, review_link_clicked: true, review_received: false,
            review_requested_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        },
        {
            patient_id: patients[3]._id, doctor_id: doctor._id, business_id: BUSINESS_ID,
            appointment_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000), // -5 days 4pm (completed)
            service_type: 'Consultation', status: 'Completed', preferred_slot: 'Evening', duration_minutes: 20,
            review_requested: true, review_link_clicked: false, review_received: false,
            review_requested_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
        },
        {
            patient_id: patients[4]._id, doctor_id: doctor._id, business_id: BUSINESS_ID,
            appointment_date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // Yesterday 11am (cancelled)
            service_type: 'Braces Adjustment', status: 'Cancelled', preferred_slot: 'Morning', duration_minutes: 15,
            review_requested: false, review_link_clicked: false, review_received: false,
        },
        {
            patient_id: patients[5]._id, doctor_id: doctor._id, business_id: BUSINESS_ID,
            appointment_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // +7 days 3pm (requested/pending)
            service_type: 'Follow-up', status: 'Requested', preferred_slot: 'Afternoon', duration_minutes: 15,
            review_requested: false, review_link_clicked: false, review_received: false,
        },
    ];

    const appointments = await Appointment.insertMany(appointmentsData);
    console.log(`✓ ${appointments.length} appointments created`);

    console.log('\n✅ Seed complete! Business ID:', BUSINESS_ID.toString());
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
