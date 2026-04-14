import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Business from './models/Business';
import Doctor from './models/Doctor';
import Patient from './models/Patient';
import Appointment from './models/Appointment';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/google-review-agent');
    console.log('Connected to MongoDB');

    const businessId = new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1');
    
    // 1. Seed Business
    await Business.updateOne(
      { _id: businessId },
      { 
        name: "Demo Clinic",
        google_review_url: "https://g.page/r/example/review",
        industry_type: "dentist",
        message_templates: [
          { service_category: "dentist", template: "Hi {name}! Thanks for visiting {business_name}. Please review us: {review_url}" }
        ],
        api_key: "demo_key_123"
      },
      { upsert: true }
    );
    console.log('Business seeded');

    // 2. Seed Doctor
    const doctor = await Doctor.findOneAndUpdate(
      { name: "Dr. Smith", business_id: businessId },
      { specialization: "General Dentist", active: true },
      { upsert: true, new: true }
    );
    console.log('Doctor seeded');

    // 3. Seed Patient
    const patient = await Patient.findOneAndUpdate(
      { name: "John Doe", business_id: businessId },
      { phone: "1234567890", status: "Active" },
      { upsert: true, new: true }
    );
    console.log('Patient seeded');

    // 4. Seed Appointment
    await Appointment.findOneAndUpdate(
      { patient_id: patient._id, business_id: businessId },
      { 
        doctor_id: doctor._id, 
        appointment_date: new Date(), 
        service_type: "Consultation", 
        status: "Booked" 
      },
      { upsert: true }
    );
    console.log('Appointment seeded');

    console.log('All data seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();