import mongoose, { Document, Schema } from 'mongoose';

export interface IBroadcastLog extends Document {
  business_id: mongoose.Types.ObjectId;
  template_name: string;
  total_selected: number;
  total_queued: number;
  skipped_opted_out: number;
  createdAt: Date;
}

const BroadcastLogSchema: Schema = new Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  template_name: { type: String, required: true },
  total_selected: { type: Number, required: true, default: 0 },
  total_queued: { type: Number, required: true, default: 0 },
  skipped_opted_out: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IBroadcastLog>('BroadcastLog', BroadcastLogSchema);
