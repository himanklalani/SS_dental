import mongoose, { Document, Schema } from 'mongoose';

export interface IAppointment extends Document {
  business_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  doctor_id?: mongoose.Types.ObjectId;
  
  appointment_date?: Date;
  duration_minutes: number;
  status: 'Requested' | 'Booked' | 'Confirmed' | 'Cancelled' | 'No-show' | 'Completed';
  preferred_slot?: 'Morning' | 'Afternoon' | 'Evening';
  
  service_type: string; // e.g., 'Consultation', 'Root Canal'
  sub_service?: string; // e.g., 'Composite Filling - Upper Right'
  tooth_number?: string;
  quadrant?: string;
  
  planned_treatment?: string;
  chief_complaint?: string;
  notes?: string;

  // Follow-up Info (Embedded for simplicity)
  follow_up?: {
    date: Date;
    type: string;
    status: 'Pending' | 'Done' | 'Rescheduled';
  };

  // Review Integration
  review_requested: boolean;
  review_requested_at?: Date;
  review_link_clicked: boolean;
  review_link_clicked_at?: Date;
  review_received: boolean;
  review_data?: {
    platform: string;
    score: number;
    comments: string;
    received_at: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema: Schema = new Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  
  appointment_date: { type: Date },
  duration_minutes: { type: Number, default: 15 },
  status: { 
    type: String, 
    enum: ['Requested', 'Booked', 'Confirmed', 'Cancelled', 'No-show', 'Completed'],
    default: 'Requested'
  },
  preferred_slot: {
    type: String,
    enum: ['Morning', 'Afternoon', 'Evening']
  },
  
  service_type: { type: String, required: true },
  sub_service: { type: String },
  tooth_number: { type: String },
  quadrant: { type: String },
  
  planned_treatment: { type: String },
  chief_complaint: { type: String },
  notes: { type: String },

  follow_up: {
    date: Date,
    type: String,
    status: { 
      type: String, 
      enum: ['Pending', 'Done', 'Rescheduled'],
      default: 'Pending'
    }
  },

  review_requested: { type: Boolean, default: false },
  review_requested_at: { type: Date },
  review_link_clicked: { type: Boolean, default: false },
  review_link_clicked_at: { type: Date },
  review_received: { type: Boolean, default: false },
  review_data: {
    platform: String,
    score: Number,
    comments: String,
    received_at: Date
  }
}, { timestamps: true });

// Index for efficient querying
AppointmentSchema.index({ business_id: 1, appointment_date: 1 });
AppointmentSchema.index({ patient_id: 1 });

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema);
