import Product from '../models/Product.js';
import Settings from '../models/Settings.js';
import { analyzeProduct } from './geminiService.js';
import { publishProductUpdate, publishQueueUpdate } from './productEvents.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let job = null;

const snapshot = () => job ? { ...job, active: job.running } : { active: false, done: 0, total: 0, failed: 0, remaining: 0 };
const broadcast = () => publishQueueUpdate(snapshot());

export const getQueueStatus = () => snapshot();

export const heartbeat = (sessionId) => {
  if (job?.sessionId === sessionId) job.lastHeartbeat = Date.now();
  return snapshot();
};

export const startQueue = async (sessionId) => {
  if (job?.running) return snapshot();
  const total = await Product.countDocuments({ status: 'RAW' });
  if (!total) return { active: false, done: 0, total: 0, failed: 0, remaining: 0 };

  job = { sessionId, running: true, done: 0, total, failed: 0, remaining: total, lastHeartbeat: Date.now() };
  broadcast();
  runQueue().catch((error) => {
    console.error('[processingQueue] worker crashed:', error);
    if (job) { job.running = false; job.error = error.message; broadcast(); }
  });
  return snapshot();
};

async function runQueue() {
  const settings = await Settings.getSingleton();
  const rpm = parseInt(process.env.GEMINI_RPM) || 5;
  const delayMs = Math.ceil(60000 / rpm) + 500;

  while (job?.running) {
    // Navigation does not interrupt this worker. When its owning browser tab
    // closes, the App heartbeat expires and the worker stops before claiming
    // another product (an in-flight Gemini call is allowed to finish safely).
    if (Date.now() - job.lastHeartbeat > 45000) {
      job.running = false;
      job.paused = true;
      broadcast();
      break;
    }

    const product = await Product.findOneAndUpdate(
      { status: 'RAW' },
      { $set: { status: 'PROCESSING', processingError: undefined } },
      { new: true, sort: { createdAt: 1 } }
    );
    if (!product) { job.running = false; job.remaining = 0; broadcast(); break; }
    publishProductUpdate(product);

    try {
      const { intelligence, aiConfidenceScore } = await analyzeProduct(product.rawInput);
      product.intelligence = intelligence;
      product.aiConfidenceScore = aiConfidenceScore;
      product.status = aiConfidenceScore >= settings.confidenceThreshold
        ? 'AUTO_APPROVED'
        : aiConfidenceScore >= settings.confidenceThreshold - 30 ? 'NEEDS_REVIEW' : 'HIGH_RISK';
      product.processingError = undefined;
    } catch (error) {
      console.error(`Failed to process product ${product._id}:`, error.message);
      product.status = 'NEEDS_REVIEW';
      product.processingError = error.message;
      job.failed++;
    }

    await product.save();
    job.done++;
    job.remaining = await Product.countDocuments({ status: 'RAW' });
    publishProductUpdate(product);
    broadcast();
    if (job.remaining > 0 && job.running) await sleep(delayMs);
  }
}
