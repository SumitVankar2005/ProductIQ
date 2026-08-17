# ProductIQ — AI-Powered Industrial Product Intelligence

Turns fragmented product catalog data into trusted product intelligence using
Google Gemini, with a human-in-the-loop review queue and an evaluation
pipeline that scores AI accuracy against real ground-truth data.

## Stack

- Frontend: React 18, Vite, Tailwind, Recharts
- Backend: Node.js (ESM), Express, MongoDB/Mongoose
- AI: Google Gemini (`gemini-2.5-flash` by default)

## Setup

### 1. Backend

```bash
cd server
cp .env.example .env   # then fill in real values
npm install
npm run dev             # nodemon, auto-restarts on change
# or: npm start
```

Required environment variables (`server/.env`):

| Variable | Description |
|---|---|
| `MONGODB_URI` | Your MongoDB connection string. The server refuses to start without this. |
| `GEMINI_API_KEY` | Your Google AI Studio Gemini API key. Required to actually run AI enrichment. |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash`. |
| `PORT` | Defaults to `5000`. |
| `DEMO_PRODUCT_LIMIT` | Server-side upper bound for one API batch. Defaults to `3`; the dashboard automatically chains safe batches to process the whole queue. |
| `CORS_ORIGIN` | Comma-separated allowed origins for the frontend in production, e.g. `https://yourapp.com`. Left open in dev if unset. |

### 2. Frontend

```bash
cd client
cp .env.example .env   # points at your backend, defaults to localhost:5000
npm install
npm run dev
```

### 3. Use it

1. Open the app, go to **Upload Data**.
2. Upload your raw catalog CSV (e.g. `Unihack_ Sample Dataset - Input.csv`).
   Recognized columns: `Mfg_Part_Num`, `Part_Desc`, `Part_Manuf`, `Brand`
   (case-insensitive fallbacks like `mfgPartNum` also work).
3. (Optional, for evaluation) Upload your expected-output ground-truth CSV
   (e.g. `Unihack_ Expected Output - Delivery Format.csv`) on the same page.
4. Go to **Dashboard** and click **Process Pending Products** — this calls
   Gemini for each RAW product and routes it to `AUTO_APPROVED`,
   `NEEDS_REVIEW`, or `HIGH_RISK` based on the confidence threshold in
   **Settings**. Records are automatically split into short batches, so a
   queue of 10+ products does not depend on one long browser request.
5. Resolve flagged items in **Review Queue** (approve / reject).
6. If you uploaded ground truth, go to **AI Training & Eval** and click
   **Run Evaluation** to score AI predictions against it — this is real,
   computed data (per-field accuracy + an error table), not a mock.

## How enrichment works

`server/services/geminiService.js` sends each raw product row to Gemini with
a JSON schema (`responseSchema` + `responseMimeType: "application/json"`) so
the model returns a structured `{ manufacturer, brand, classification,
attributes, content }` object with a 0–100 confidence per field. The route
handler in `server/routes/api.js` then averages those into an overall
`aiConfidenceScore` and routes the product:

- `>= confidenceThreshold` → `AUTO_APPROVED`
- `>= confidenceThreshold - 30` → `NEEDS_REVIEW`
- otherwise → `HIGH_RISK`

`confidenceThreshold` is configurable from the **Settings** page (persisted
in MongoDB, not hardcoded).

## Production notes

- **Secrets**: never commit `server/.env` or `client/.env`. Both have
  `.gitignore` entries for this already.
- **CORS**: set `CORS_ORIGIN` in `server/.env` to your real frontend URL(s)
  before deploying; the code reflects any origin if it's left unset, which is
  meant for local dev only.
- **Gemini errors**: `analyzeProduct` retries transient errors (rate limits,
  503s, malformed JSON) with exponential backoff, and a product that still
  fails is routed to `NEEDS_REVIEW` with the error message saved on the
  product (`processingError`) rather than crashing the batch.
- **Build**: `cd client && npm run build` outputs static files to
  `client/dist/`, servable from any static host (or behind the same Express
  server with `express.static` if you prefer a single deployable).
