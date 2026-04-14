import mongoose, { Document, Schema } from 'mongoose';

export interface IDoctor extends Document {
  business_id: mongoose.Types.ObjectId;
  name: string;
  specialization: string;
  phone?: string;
  email?: string;
  active: boolean;
}

const DoctorSchema: Schema = new Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  name: { type: String, required: true },
  specialization: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model<IDoctor>('Doctor', DoctorSchema);
