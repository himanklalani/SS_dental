const mongoose = require('mongoose');
const businessIdStr = '65f1a2b3c4d5e6f7a8b9c0d1';
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/google-review-agent';

async function seed() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const bid = new mongoose.Types.ObjectId(businessIdStr);

        // 1. Business
        const Business = mongoose.model('Business', new mongoose.Schema({ 
            _id: mongoose.Schema.Types.ObjectId,
            name: String, 
            industry_type: String, 
            google_review_url: String, 
            api_key: String, 
            message_templates: Array 
        }));
        
        await Business.updateOne(
            { _id: bid }, 
            { $set: { 
                name: 'Demo Clinic', 
                industry_type: 'dentist', 
                google_review_url: 'https://g.page/r/example/review', 
                api_key: 'demo_key_123', 
                message_templates: [{ 
                    service_category: 'dentist', 
                    template: 'Hi {name}! Thanks for visiting {business_name}. Please review us: {review_url}' 
                }] 
            }}, 
            { upsert: true }
        );
        console.log('Business seeded');

        // 2. Doctor
        const Doctor = mongoose.model('Doctor', new mongoose.Schema({ 
            name: String, 
            specialization: String, 
            business_id: mongoose.Schema.Types.ObjectId, 
            active: Boolean 
        }));
        
        await Doctor.updateOne(
            { name: 'Dr. Smith', business_id: bid }, 
            { $set: { specialization: 'General Dentist', active: true } }, 
            { upsert: true }
        );
        const doc = await Doctor.findOne({ name: 'Dr. Smith', business_id: bid });
        console.log('Doctor seeded');

        // 3. Patient
        const Patient = mongoose.model('Patient', new mongoose.Schema({ 
            name: String, 
            phone: String, 
            business_id: mongoose.Schema.Types.ObjectId, 
            status: String 
        }));
        
        await Patient.updateOne(
            { name: 'John Doe', business_id: bid }, 
            { $set: { phone: '1234567890', status: 'Active' } }, 
            { upsert: true }
        );
        const pat = await Patient.findOne({ name: 'John Doe', business_id: bid });
        console.log('Patient seeded');

        // 4. Appointment
        const Appointment = mongoose.model('Appointment', new mongoose.Schema({ 
            patient_id: mongoose.Schema.Types.ObjectId, 
            doctor_id: mongoose.Schema.Types.ObjectId, 
            business_id: mongoose.Schema.Types.ObjectId, 
            appointment_date: Date, 
            service_type: String, 
            status: String 
        }));
        
        await Appointment.deleteMany({ business_id: bid });
        await Appointment.create({ 
            patient_id: pat._id, 
            doctor_id: doc._id, 
            business_id: bid, 
            appointment_date: new Date(), 
            service_type: 'Consultation', 
            status: 'Booked' 
        });
        console.log('Appointment seeded');

        console.log('All seed data completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Seed Error:', e);
        process.exit(1);
    }
}

seed();
