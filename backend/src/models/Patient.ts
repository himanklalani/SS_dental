import mongoose, { Document, Schema } from 'mongoose';

export interface IPatient extends Document {
  business_id: mongoose.Types.ObjectId;
  
  // Basic Info
  name: string;
  date_of_birth: Date;
  gender: string;
  
  // Contact
  phone: string;
  secondary_phone?: string;
  email?: string;
  address?: {
    locality: string;
    city: string;
    pin: string;
  };
  emergency_contact?: {
    name: string;
    phone: string;
  };

  // Medical
  medical_history: string[]; // checklist items
  allergies: string[];
  current_medications: string[];
  
  // Meta
  referred_by?: string;
  preferred_contact: 'Call' | 'SMS' | 'WhatsApp' | 'Email';
  status: 'New' | 'Active' | 'Inactive' | 'Lost';
  tags: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema: Schema = new Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  
  name: { type: String, required: true },
  date_of_birth: { type: Date },
  gender: { type: String },
  
  phone: { type: String, required: true },
  secondary_phone: { type: String },
  email: { type: String },
  address: {
    locality: String,
    city: String,
    pin: String
  },
  emergency_contact: {
    name: String,
    phone: String
  },

  medical_history: [{ type: String }],
  allergies: [{ type: String }],
  current_medications: [{ type: String }],
  
  referred_by: { type: String },
  preferred_contact: { 
    type: String, 
    enum: ['Call', 'SMS', 'WhatsApp', 'Email'],
    default: 'WhatsApp'
  },
  status: { 
    type: String, 
    enum: ['New', 'Active', 'Inactive', 'Lost'],
    default: 'New'
  },
  tags: [{ type: String }]
}, { timestamps: true });

export default mongoose.model<IPatient>('Patient', PatientSchema);
