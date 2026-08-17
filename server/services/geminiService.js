import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_api_key_here') {
  console.warn(
    '[geminiService] GEMINI_API_KEY is not set. Set it in server/.env before processing products.'
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    manufacturer: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['value', 'confidence'],
    },
    brand: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['value', 'confidence'],
    },
    classification: {
      type: 'object',
      properties: {
        department: { type: 'string' },
        class: { type: 'string' },
        fine: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['department', 'class', 'fine', 'confidence'],
    },
    attributes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          uom: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['label', 'value', 'confidence'],
      },
    },
    content: {
      type: 'object',
      properties: {
        productTitle: { type: 'string' },
        shortDescription: { type: 'string' },
      },
      required: ['productTitle', 'shortDescription'],
    },
  },
  required: ['manufacturer', 'brand', 'classification', 'attributes', 'content'],
};

const buildPrompt = (rawProduct) => `
You are an industrial product data enrichment engine used in a PIM (Product
Information Management) pipeline. Given fragmented, messy raw catalog data,
extract clean, structured product intelligence.

RAW PRODUCT DATA:
${JSON.stringify(rawProduct)}

Rules:
- "confidence" fields are your own calibrated confidence from 0-100 that the
  value is correct, based on how directly it is supported by the raw input.
- If a value cannot be determined from the raw input, still return your best
  guess but give it a low confidence score (below 50) rather than omitting it.
- "classification" should follow a department > class > fine-grained hierarchy
  typical of an industrial/hardware product catalog (e.g. department:
  "Power Tools", class: "Grinders", fine: "Angle Grinders").
- "attributes" should include normalized physical/technical attributes you can
  infer (dimensions, material, pack quantity, etc.), each with a "uom" (unit
  of measure) when applicable, otherwise omit uom.
- Keep "content.shortDescription" under 200 characters and written in clear,
  customer-facing language.
- Respond ONLY with a single JSON object matching the required schema. No
  markdown fences, no commentary.
`;

const attributeValidationStatus = (confidence) => {
  if (confidence >= 85) return 'VALID';
  if (confidence >= 50) return 'NEEDS_REVIEW';
  return 'INVALID';
};

// Weighted overall confidence used to drive the auto-approve / review /
// high-risk routing in routes/api.js.
const computeOverallConfidence = (parsed) => {
  const scores = [
    parsed.manufacturer?.confidence,
    parsed.brand?.confidence,
    parsed.classification?.confidence,
    ...(parsed.attributes || []).map((a) => a.confidence),
  ].filter((n) => typeof n === 'number' && !Number.isNaN(n));

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google returns a google.rpc.RetryInfo detail on 429s telling us exactly how
// long to wait (e.g. "2.34s"). Use that when present instead of guessing.
const extractRetryDelayMs = (error) => {
  const retryInfo = error?.errorDetails?.find((d) =>
    d['@type']?.includes('RetryInfo')
  );
  const raw = retryInfo?.retryDelay; // e.g. "2.342863314s"
  if (!raw) return null;
  const seconds = parseFloat(raw);
  return Number.isNaN(seconds) ? null : Math.ceil(seconds * 1000);
};

const parseModelJson = (text) => {
  // Gemini can occasionally wrap JSON in markdown fences even when asked not
  // to — strip them defensively before parsing.
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
};

/**
 * Calls Gemini to enrich a single raw product row and returns an object
 * matching the Product.intelligence schema, plus a top-level
 * aiConfidenceScore. Returns null (never throws) on unrecoverable failure so
 * callers can route the product to NEEDS_REVIEW instead of crashing a batch.
 */
export const analyzeProduct = async (rawProduct, { maxRetries = 2 } = {}) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = genAI.getGenerativeModel(
    {
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    },
    // JSON mode (responseMimeType/responseSchema) only exists on the v1beta
    // endpoint. @google/generative-ai@0.24.1 defaults to v1beta already, but
    // this is pinned explicitly so it keeps working even if that default
    // ever changes.
    { apiVersion: 'v1beta' }
  );

  const prompt = buildPrompt(rawProduct);
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseModelJson(text);

      const intelligence = {
        manufacturer: {
          value: parsed.manufacturer?.value || '',
          confidence: parsed.manufacturer?.confidence ?? 0,
          source: 'GEMINI_AI',
        },
        brand: {
          value: parsed.brand?.value || '',
          confidence: parsed.brand?.confidence ?? 0,
          source: 'GEMINI_AI',
        },
        classification: {
          department: parsed.classification?.department || '',
          class: parsed.classification?.class || '',
          fine: parsed.classification?.fine || '',
          confidence: parsed.classification?.confidence ?? 0,
        },
        attributes: (parsed.attributes || []).map((a) => ({
          label: a.label,
          value: a.value,
          uom: a.uom || '',
          confidence: a.confidence ?? 0,
          validationStatus: attributeValidationStatus(a.confidence ?? 0),
        })),
        content: {
          productTitle: parsed.content?.productTitle || '',
          shortDescription: parsed.content?.shortDescription || '',
        },
      };

      return { intelligence, aiConfidenceScore: computeOverallConfidence(parsed) };
    } catch (error) {
      lastError = error;
      const isRetryable =
        error?.status === 429 || error?.status === 503 || error instanceof SyntaxError;
      console.error(
        `[geminiService] attempt ${attempt + 1}/${maxRetries + 1} failed:`,
        error.message
      );
      if (!isRetryable || attempt === maxRetries) break;

      const suggestedDelay = extractRetryDelayMs(error);
      const backoffDelay = 1000 * 2 ** attempt;
      await sleep(suggestedDelay ?? backoffDelay);
    }
  }

  throw lastError;
};
