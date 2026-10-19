# 🧾⚡ ChaoticSplitter

> **Multimodal Voice & Receipt Bill Splitter with Zero-Leakage Precision**  
> Powered by **Gemma 4**, **ElevenLabs Scribe STT**, **Prior Labs TabPFN-3.5**, and **Sentry Observability**.

---

## 💡 The Core Architectural Principle

> **"Never let an LLM do arithmetic."**

Language models excel at understanding unstructured, messy human inputs — deciphering crumpled thermal restaurant receipts and parsing natural conversational splitting rules (*"Me and Rahul shared the pizza, Neha only had iced latte, apply the 15% discount across everything"*). 

However, LLMs hallucinate numbers and make rounding errors. **ChaoticSplitter** solves this with a hybrid architecture:
1. **Multimodal AI (Gemma 4 & ElevenLabs Scribe)** handles perception, vision OCR, speech transcription, and semantic rule mapping.
2. **Prior Labs TabPFN-3.5** audits the extracted tabular bill data for anomalies and predicts fair tip percentages.
3. **Deterministic Python `decimal.Decimal` Math Engine** calculates 100% of the proportional taxes, service charges, discounts, and zero-leakage penny reconciliation.
4. **Sentry Distributed Agent Tracing** provides telemetry and performance monitoring across every pipeline span.

---

## 🚀 Key Features & 4-Step Workflow

```
[ User Smartphone / Browser (React + TypeScript) ]
     │
     ├── Step 0: Group Setup (Voice Note / Direct Input) ──► ElevenLabs STT + Gemma 4 Extraction
     │
     ├── Step 1: Snap Receipt (Live Camera / File Upload) ──► Vision OCR + TabPFN Anomaly Guardian
     │
     ├── Step 2: Explain Split (Voice Memo OR Text Typing) ──► Gemma 4 Semantic Item Mapping
     │
     ├── Step 3: Verify & Fine-Tune (Tappable Friend Chips) ──► Live Python Decimal Recalculation
     │
     └── Step 4: Settle & Pay (1-Tap UPI & Dynamic QR) ──► Personalized Scan-to-Pay Codes + WhatsApp Export
```

1. **Step 0: Group Setup**
   - Tap record and speak: *"Trip to Goa with Alice, Bob, and Charlie"*.
   - Transcribed via ElevenLabs Scribe and structured into participant lists via Gemma 4.
2. **Step 1: Receipt Vision & TabPFN Outlier Check**
   - Live camera capture or image file upload.
   - Extracts merchant name, currency, line items, quantities, subtotal, and taxes.
   - **Prior Labs TabPFN Guardian** immediately flags if extracted dish prices don't match the printed subtotal or if a price is an OCR outlier.
3. **Step 2: Explain Split (Voice or Text)**
   - Record a voice memo or type natural splitting instructions.
   - Gemma 4 interprets food allocations, sharing weights, and exclusions.
   - Unmentioned dishes automatically route according to configurable policies (e.g. split equally among all).
4. **Step 3: Interactive Live Recalculation**
   - Tap member pills beside any line item to toggle assignments with live penny reconciliation.
   - Real-time **ZERO-LEAKAGE VERIFIED** badge proves that the sum of individual shares strictly equals the receipt grand total.
5. **Step 4: Direct In-App Settlement**
   - Select who covered the bill.
   - Generates personalized dynamic **UPI QR codes** (GPay, PhonePe, Paytm, BHIM) and 1-tap deep links for every non-payer.
   - 1-click **WhatsApp summary** generator formatted with bold markdown and emojis.

---

## 🏆 Hackathon Sponsor Tracks Matrix

| Sponsor | Integration Point | Purpose |
| :--- | :--- | :--- |
| **Gemma** | `gemma4:31b` via Ollama Cloud API | • Multimodal vision OCR receipt line-item extraction.<br>• Conversational instruction semantic reasoning & item-to-participant allocation matrix. |
| **Prior Labs (TabPFN)** | `TabPFNRegressor` (`tabpfn>=9.2.0`) | • **Anomaly Guardian**: Flags OCR subtotal discrepancies and price outliers.<br>• **Tip Predictor**: Tabular regression on group size and bill total to suggest fair gratuity. |
| **ElevenLabs** | Scribe STT (`scribe_v1`) | Ultra-accurate speech-to-text transcription of group setups and natural voice splitting memos. |
| **Sentry** | `sentry-sdk` Agent Tracing | Distributed tracing capturing discrete child spans (`ai.stt`, `ai.ocr`, `ai.llm`, `ai.ml.tabpfn`, `math.settlement`). |

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS design system (dark mode, glassmorphism, responsive grid, sharp rectangular aesthetics).
- **Backend**: Python 3.11+, FastAPI, Uvicorn, Pydantic v2.
- **Math Engine**: Python `decimal.Decimal` with `ROUND_HALF_UP` zero-leakage penny balancing.
- **AI & Observability SDKs**: `tabpfn`, `elevenlabs`, `sentry-sdk`, `qrcode`, `pillow`, `pandas`, `numpy`.

---

## 📦 Project Structure

```
chaoticSplitter/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI REST routes, CORS & telemetry endpoints
│   │   ├── config.py                # Centralized settings & environment variables
│   │   ├── schemas.py               # Pydantic data contracts (Receipt, Plan, Settlement)
│   │   ├── math_engine.py           # Zero-leakage Decimal settlement & dynamic QR generator
│   │   ├── telemetry.py             # Sentry SDK agent tracing & performance spans
│   │   └── services/
│   │       ├── stt_service.py       # ElevenLabs Scribe STT integration
│   │       ├── ocr_service.py       # Vision receipt OCR extraction
│   │       ├── gemma_service.py     # Gemma 4 group extraction
│   │       ├── split_service.py     # Gemma 4 semantic rule reasoner
│   │       └── anomaly_service.py   # Prior Labs TabPFN-3.5 Anomaly Guardian & Tip Predictor
│   ├── requirements.txt             # Python backend dependencies
│   ├── .env.example                 # Example environment template
│   └── .env                         # Local API keys (excluded from git)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── navbar.tsx           # Responsive header with backend connectivity indicator
│   │   │   ├── footer.tsx           # Footer with hackathon credits
│   │   │   ├── groupSetup.tsx       # Step 0: Voice & text group formation
│   │   │   ├── snapReceipt.tsx      # Step 1: Camera capture & receipt OCR preview
│   │   │   ├── receiptPreviewPanel.tsx # Persistent reference drawer with TabPFN alerts
│   │   │   ├── explainSplit.tsx     # Step 2: Voice memo recorder & prompt text area
│   │   │   ├── verifyItems.tsx      # Step 3: Interactive checklist & live math status
│   │   │   └── settlePay.tsx        # Step 4: UPI payment QR codes & WhatsApp summary
│   │   ├── services/
│   │   │   └── api.ts               # Axios API client
│   │   ├── types/
│   │   │   └── index.ts             # Shared TypeScript schemas matching Pydantic
│   │   ├── App.tsx                  # Main application orchestrator
│   │   ├── index.css                # Global responsive dark styling & media queries
│   │   └── main.tsx                 # React DOM bootstrap
│   ├── package.json                 # Frontend dependencies
│   └── vite.config.ts               # Vite proxy configuration
└── README.md                        # Documentation
```

---

## 🏃 Local Development Quickstart

### 1. Prerequisites
- **Node.js** 18+ and `npm`
- **Python** 3.11+
- Virtual environment or conda environment

### 2. Backend Setup
```bash
cd backend

# Create & activate a virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure your API keys in backend/.env
cp .env.example .env
```

Your `backend/.env` file:
```ini
OLLAMA_API_KEY=your_ollama_api_key
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gemma4:31b
OCR_MODEL=gemma4:31b

ELEVENLABS_API_KEY=your_elevenlabs_api_key
TABPFN_API_KEY=your_tabpfn_api_key
SENTRY_DSN=https://your_sentry_dsn_here
```

Start the FastAPI server:
```bash
python -m uvicorn app.main:app --reload --port 8000
```
*API will run at `http://127.0.0.1:8000`. Interactive docs at `http://127.0.0.1:8000/docs`.*

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
*Frontend will run at `http://localhost:5173` with proxying to backend `/api`.*

---

## 🔍 Observability & Testing

- **Backend Healthcheck**: `GET http://127.0.0.1:8000/api/health`
- **Sentry Trace Verification**: `GET http://127.0.0.1:8000/api/sentry-test`  
  *(Triggers a live telemetry span and breadcrumb visible immediately in your Sentry dashboard).*
- **TabPFN Direct Audit**: `POST http://127.0.0.1:8000/api/audit/tabpfn`

---

## 🌐 Deployment Checklist (Render / DigitalOcean / Vercel)

1. **Backend (Render / Railway / DigitalOcean)**:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set Environment Variables: `OLLAMA_API_KEY`, `ELEVENLABS_API_KEY`, `TABPFN_API_KEY`, `SENTRY_DSN`, `ENVIRONMENT=production`.
2. **Frontend (Vercel / Netlify / Cloudflare Pages)**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Proxy or set `VITE_API_BASE_URL` pointing to the deployed backend URL.

---

## 📄 License
MIT License • Built for Hacktoberfest 2026.
