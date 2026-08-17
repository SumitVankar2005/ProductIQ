import mongoose from 'mongoose';

// Stores rows uploaded from a "ground truth" / expected-output CSV so the
// Training Center can score AI predictions against real labeled data instead
// of showing static numbers.
const GroundTruthSchema = new mongoose.Schema(
  {
    mfgPartNum: { type: String, index: true },
    manufacturer: String,
    brand: String,
    department: String,
    class: String,
    fine: String,
    shortDescription: String,
    raw: { type: mongoose.Schema.Types.Mixed }, // full original row, for reference
  },
  { timestamps: true }
);

export default mongoose.model('GroundTruth', GroundTruthSchema);
