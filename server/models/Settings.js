import mongoose from 'mongoose';

// Singleton settings document (there is only ever one, keyed by `key: 'global'`).
const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    confidenceThreshold: { type: Number, default: 90, min: 0, max: 100 },
    geminiModel: { type: String, default: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
    fieldWeights: {
      manufacturer: { type: Number, default: 25 },
      brand: { type: Number, default: 20 },
      classification: { type: Number, default: 25 },
      description: { type: Number, default: 15 },
      attributes: { type: Number, default: 15 },
    },
  },
  { timestamps: true }
);

SettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ key: 'global' });
  if (!settings) {
    settings = await this.create({ key: 'global' });
  }
  return settings;
};

export default mongoose.model('Settings', SettingsSchema);
