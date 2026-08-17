import mongoose from 'mongoose';

// One document per "Run Evaluation" click in the Training Center. Keeping a
// history lets the UI plot real improvement-over-time instead of a fake chart.
const EvalRunSchema = new mongoose.Schema(
  {
    overallScore: Number,
    matchedCount: Number,
    groundTruthCount: Number,
    fieldScores: {
      manufacturer: Number,
      brand: Number,
      classification: Number,
      description: Number,
      attributes: Number,
    },
    mismatches: [
      {
        mfgPartNum: String,
        field: String,
        expected: String,
        predicted: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('EvalRun', EvalRunSchema);
