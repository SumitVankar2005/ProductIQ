import express from 'express';
import Papa from 'papaparse';
import Product from '../models/Product.js';
import Settings from '../models/Settings.js';
import GroundTruth from '../models/GroundTruth.js';
import EvalRun from '../models/EvalRun.js';
import { analyzeProduct } from '../services/geminiService.js';
import { calculateProductScore, aggregateScores } from '../services/scoringEngine.js';

const router = express.Router();

// Small helper so every route gets consistent error handling without a
// try/catch block copy-pasted into every handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// -------------------- Health --------------------
router.get('/health', (req, res) => res.json({ ok: true }));

// -------------------- Dashboard --------------------
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [total, pending, processing, needsReview, highRisk, autoApproved] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'RAW' }),
      Product.countDocuments({ status: 'PROCESSING' }),
      Product.countDocuments({ status: 'NEEDS_REVIEW' }),
      Product.countDocuments({ status: 'HIGH_RISK' }),
      Product.countDocuments({ status: 'AUTO_APPROVED' }),
    ]);
    const processed = total - pending - processing;
    res.json({
      total,
      pending,
      processing,
      processed,
      needsReview,
      highRisk,
      autoApproved,
      reviewQueueCount: needsReview + highRisk,
    });
  })
);

// -------------------- Products --------------------

// Fetch products with optional status filter, text search, and pagination.
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { 'rawInput.mfgPartNum': { $regex: search, $options: 'i' } },
        { 'rawInput.partDesc': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize),
      Product.countDocuments(query),
    ]);

    res.json({ products, total, page: pageNum, pageSize, totalPages: Math.ceil(total / pageSize) });
  })
);

router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  })
);

// Human review actions from the Review Queue page.
router.patch(
  '/products/:id/approve',
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'AUTO_APPROVED', reviewNotes: req.body?.notes || undefined },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  })
);

router.patch(
  '/products/:id/reject',
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'REJECTED', reviewNotes: req.body?.notes || undefined },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  })
);

// Manual correction of AI-extracted fields (used from the detail/edit view).
router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const { intelligence, status } = req.body;
    const update = {};
    if (intelligence) update.intelligence = intelligence;
    if (status) update.status = status;
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  })
);

// Bulk CSV upload -> RAW products.
router.post(
  '/upload',
  asyncHandler(async (req, res) => {
    const rawArray = req.body.data;
    if (!Array.isArray(rawArray) || rawArray.length === 0) {
      return res.status(400).json({ error: 'No rows found in upload' });
    }

    const productDocs = rawArray
      .map((item) => ({
        rawInput: {
          mfgPartNum: item.Mfg_Part_Num || item.mfgPartNum || item.MPN || '',
          partDesc: item.Part_Desc || item.partDesc || item.Description || '',
          partManuf: item.Part_Manuf || item.partManuf || item.Manufacturer || '',
          brand: item.Brand || item.brand || '',
        },
        status: 'RAW',
      }))
      .filter((doc) => doc.rawInput.mfgPartNum || doc.rawInput.partDesc);

    if (productDocs.length === 0) {
      return res.status(400).json({ error: 'Could not find recognizable columns in the CSV' });
    }

    const inserted = await Product.insertMany(productDocs);
    res.json({ success: true, count: inserted.length });
  })
);

// Process a small, safe batch of RAW items via Gemini. Keeping each request
// short prevents browser/reverse-proxy timeouts; the client can chain batches
// to process any number of records while showing progress.
//
// Requests are spaced out to stay under Gemini's requests-per-minute quota
// (5 RPM on the free tier for gemini-2.5-flash as of writing — configurable
// via GEMINI_RPM if you're on a paid tier with a higher limit). Without this,
// a batch of more than ~5 products hits 429 "Too Many Requests" almost
// immediately.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.post(
  '/process-batch',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    const configuredLimit = parseInt(process.env.DEMO_PRODUCT_LIMIT) || 3;
    const requestedLimit = parseInt(req.body?.limit);
    // Never allow one HTTP request to become a long-running "process 10" job.
    const limit = Math.min(Math.max(requestedLimit || configuredLimit, 1), configuredLimit);
    const rpm = parseInt(process.env.GEMINI_RPM) || 5;
    const delayBetweenRequestsMs = Math.ceil(60000 / rpm) + 500; // small buffer
    const pendingAtStart = await Product.countDocuments({ status: 'RAW' });
    const itemsToAttempt = Math.min(limit, pendingAtStart);

    let succeeded = 0;
    let failed = 0;
    let processed = 0;

    for (let i = 0; i < itemsToAttempt; i++) {
      // Atomically claim work. This prevents duplicate Gemini calls if a user
      // opens the dashboard in two tabs or clicks the button twice.
      const product = await Product.findOneAndUpdate(
        { status: 'RAW' },
        { $set: { status: 'PROCESSING', processingError: undefined } },
        { new: true, sort: { createdAt: 1 } }
      );
      if (!product) break;
      processed++;

      try {
        const { intelligence, aiConfidenceScore } = await analyzeProduct(product.rawInput);
        product.intelligence = intelligence;
        product.aiConfidenceScore = aiConfidenceScore;

        if (aiConfidenceScore >= settings.confidenceThreshold) {
          product.status = 'AUTO_APPROVED';
        } else if (aiConfidenceScore >= settings.confidenceThreshold - 30) {
          product.status = 'NEEDS_REVIEW';
        } else {
          product.status = 'HIGH_RISK';
        }
        product.processingError = undefined;
        succeeded++;
      } catch (error) {
        console.error(`Failed to process product ${product._id}:`, error.message);
        product.status = 'NEEDS_REVIEW';
        product.processingError = error.message;
        failed++;
      }

      await product.save();

      // Throttle between requests (not after the last one) to stay under quota.
      if (i < itemsToAttempt - 1) {
        await sleep(delayBetweenRequestsMs);
      }
    }

    const remaining = await Product.countDocuments({ status: 'RAW' });
    res.json({ success: true, processed, succeeded, failed, remaining, batchLimit: limit });
  })
);

// -------------------- Settings --------------------
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    res.json(settings);
  })
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const { confidenceThreshold, fieldWeights } = req.body;
    const update = {};
    if (typeof confidenceThreshold === 'number') update.confidenceThreshold = confidenceThreshold;
    if (fieldWeights && typeof fieldWeights === 'object') update.fieldWeights = fieldWeights;

    const settings = await Settings.findOneAndUpdate({ key: 'global' }, update, {
      new: true,
      upsert: true,
    });
    res.json(settings);
  })
);

// -------------------- Training Center / Evaluation --------------------

// Upload the ground-truth ("Expected Output") CSV used to score AI accuracy.
router.post(
  '/ground-truth/upload',
  asyncHandler(async (req, res) => {
    const csvText = req.body.csv;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'Missing csv text in request body' });
    }

    const { data, errors } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (errors.length > 0 && data.length === 0) {
      return res.status(400).json({ error: 'Could not parse CSV', details: errors[0].message });
    }

    const docs = data
      .map((row) => ({
        mfgPartNum: row.Mfg_Part_Num || row.mfgPartNum || row.MPN || '',
        manufacturer: row.Manufacturer || row.manufacturer || '',
        brand: row.Brand || row.brand || '',
        department: row.Department || '',
        class: row.Class || '',
        fine: row.Fine || row.Classification || '',
        shortDescription: row.Short_Description || row.shortDescription || '',
        raw: row,
      }))
      .filter((d) => d.mfgPartNum);

    if (docs.length === 0) {
      return res.status(400).json({ error: 'No rows with a recognizable MPN column found' });
    }

    await GroundTruth.deleteMany({}); // ground truth is a full-replace dataset each upload
    const inserted = await GroundTruth.insertMany(docs);
    res.json({ success: true, count: inserted.length });
  })
);

router.get(
  '/ground-truth/count',
  asyncHandler(async (req, res) => {
    const count = await GroundTruth.countDocuments();
    res.json({ count });
  })
);

// Runs the scoring engine over every processed product that has a matching
// ground-truth row, stores the result as a new EvalRun, and returns it.
router.post(
  '/eval/run',
  asyncHandler(async (req, res) => {
    const [groundTruthRows, settings] = await Promise.all([
      GroundTruth.find(),
      Settings.getSingleton(),
    ]);

    if (groundTruthRows.length === 0) {
      return res.status(400).json({ error: 'No ground truth uploaded yet' });
    }

    const gtByMpn = new Map(groundTruthRows.map((row) => [norm(row.mfgPartNum), row]));

    const processedProducts = await Product.find({
      status: { $in: ['AUTO_APPROVED', 'NEEDS_REVIEW', 'HIGH_RISK'] },
    });

    const perProductResults = [];
    const mismatches = [];

    for (const product of processedProducts) {
      const mpn = norm(product.rawInput?.mfgPartNum);
      const truth = gtByMpn.get(mpn);
      if (!truth) continue;

      const { productScore, fieldScores } = calculateProductScore(
        product.intelligence,
        truth,
        settings.fieldWeights
      );
      perProductResults.push({ productScore, fieldScores });
      product.groundTruthScore = productScore;
      await product.save();

      if (fieldScores.manufacturer === 0) {
        mismatches.push({
          mfgPartNum: product.rawInput.mfgPartNum,
          field: 'Manufacturer',
          expected: truth.manufacturer,
          predicted: product.intelligence?.manufacturer?.value,
        });
      }
      if (fieldScores.brand === 0) {
        mismatches.push({
          mfgPartNum: product.rawInput.mfgPartNum,
          field: 'Brand',
          expected: truth.brand,
          predicted: product.intelligence?.brand?.value,
        });
      }
      if (fieldScores.classification === 0) {
        mismatches.push({
          mfgPartNum: product.rawInput.mfgPartNum,
          field: 'Classification',
          expected: truth.fine,
          predicted: product.intelligence?.classification?.fine,
        });
      }
    }

    if (perProductResults.length === 0) {
      return res
        .status(400)
        .json({ error: 'No processed products matched a ground-truth MPN yet' });
    }

    const { overallScore, fieldAverages } = aggregateScores(perProductResults);

    const evalRun = await EvalRun.create({
      overallScore,
      matchedCount: perProductResults.length,
      groundTruthCount: groundTruthRows.length,
      fieldScores: fieldAverages,
      mismatches: mismatches.slice(0, 20),
    });

    res.json(evalRun);
  })
);

function norm(v) {
  return (v || '').toString().toLowerCase().trim();
}

router.get(
  '/eval/history',
  asyncHandler(async (req, res) => {
    const runs = await EvalRun.find().sort({ createdAt: 1 });
    res.json(runs);
  })
);

router.get(
  '/eval/latest',
  asyncHandler(async (req, res) => {
    const run = await EvalRun.findOne().sort({ createdAt: -1 });
    res.json(run || null);
  })
);

export default router;
