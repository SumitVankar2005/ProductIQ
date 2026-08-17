import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema(
  {
    rawInput: {
      mfgPartNum: String,
      partDesc: String,
      partManuf: String,
      brand: String,
    },
    intelligence: {
      manufacturer: { value: String, confidence: Number, source: String },
      brand: { value: String, confidence: Number, source: String },
      classification: {
        department: String,
        class: String,
        fine: String,
        confidence: Number,
      },
      attributes: [
        {
          label: String,
          value: String,
          uom: String,
          confidence: Number,
          validationStatus: {
            type: String,
            enum: ['VALID', 'NEEDS_REVIEW', 'INVALID'],
            default: 'NEEDS_REVIEW',
          },
        },
      ],
      content: {
        productTitle: String,
        shortDescription: String,
      },
    },
    status: {
      type: String,
      enum: ['RAW', 'PROCESSING', 'AUTO_APPROVED', 'NEEDS_REVIEW', 'HIGH_RISK', 'REJECTED'],
      default: 'RAW',
    },
    aiConfidenceScore: Number,
    groundTruthScore: Number,
    reviewNotes: String,
    processingError: String,
  },
  { timestamps: true }
);

// Speed up common queries/filters used by the API.
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ 'rawInput.mfgPartNum': 'text', 'rawInput.partDesc': 'text' });

export default mongoose.model('Product', ProductSchema);
