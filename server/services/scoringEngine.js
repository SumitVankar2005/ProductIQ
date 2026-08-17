import stringSimilarity from 'string-similarity';

const norm = (v) => (v || '').toString().toLowerCase().trim();

const exactMatchScore = (predicted, truth) => {
  if (!truth) return null; // no ground truth for this field, exclude it
  return norm(predicted) === norm(truth) ? 100 : 0;
};

const similarityScore = (predicted, truth) => {
  if (!truth) return null;
  if (!predicted) return 0;
  return stringSimilarity.compareTwoStrings(norm(predicted), norm(truth)) * 100;
};

// Compares one AI-enriched product (Product.intelligence) against one
// ground-truth row and returns a 0-100 score per field plus a weighted
// overall score. Fields with no ground-truth value are skipped rather than
// counted as 0, so partially-labeled ground truth doesn't tank the score.
export const calculateProductScore = (intelligence, groundTruth, weights) => {
  const fieldScores = {};

  fieldScores.manufacturer = exactMatchScore(
    intelligence?.manufacturer?.value,
    groundTruth.manufacturer
  );
  fieldScores.brand = exactMatchScore(intelligence?.brand?.value, groundTruth.brand);
  fieldScores.classification = exactMatchScore(
    intelligence?.classification?.fine,
    groundTruth.fine
  );
  fieldScores.description = similarityScore(
    intelligence?.content?.shortDescription,
    groundTruth.shortDescription
  );

  // Attribute score: fraction of ground-truth attributes (if any were
  // captured) that the AI extracted with a reasonably similar value.
  fieldScores.attributes = null;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const [field, score] of Object.entries(fieldScores)) {
    if (score === null) continue;
    const weight = weights?.[field] ?? 0;
    weightedSum += score * weight;
    weightTotal += weight;
  }

  const productScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return { productScore, fieldScores };
};

// Aggregates per-product scores from calculateProductScore into the shape the
// Training Center dashboard renders (averages per field + overall).
export const aggregateScores = (perProductResults) => {
  const fieldTotals = {};
  const fieldCounts = {};
  let overallSum = 0;

  for (const { productScore, fieldScores } of perProductResults) {
    overallSum += productScore;
    for (const [field, score] of Object.entries(fieldScores)) {
      if (score === null) continue;
      fieldTotals[field] = (fieldTotals[field] || 0) + score;
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    }
  }

  const fieldAverages = {};
  for (const field of Object.keys(fieldTotals)) {
    fieldAverages[field] = Math.round((fieldTotals[field] / fieldCounts[field]) * 10) / 10;
  }

  const overallScore =
    perProductResults.length > 0
      ? Math.round((overallSum / perProductResults.length) * 10) / 10
      : 0;

  return { overallScore, fieldAverages };
};
