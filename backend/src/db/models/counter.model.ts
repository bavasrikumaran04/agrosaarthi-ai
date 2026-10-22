import { model, Schema } from 'mongoose';

/** Atomic sequences (e.g. human-friendly case numbers). */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters', versionKey: false },
);

export const CounterModel = model('Counter', counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  if (!doc) throw new Error(`Counter ${name} could not be incremented`);
  return doc.seq;
}
