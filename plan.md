# Master Plan: ChaoticSplitter (Receipt & Voice Splitter)

> **Core Architectural Principle:**  
> **Never let an LLM do arithmetic.**  
> Multimodal AI models (Gemma & ElevenLabs) handle unstructured and messy human inputs: OCR on crumpled thermal receipts and natural conversational splitting instructions ("Me and Rahul split the paneer, Neha only had cold coffee, apply the 15% discount across everything"). A deterministic Python engine handles 100% of the proportional tax, service charge, discount calculation, and penny-rounding math.

---

## 1. Project Overview & Target Architecture

ChaoticSplitter solves the real-world friction of dining out with friends: deciphering messy printed bills, parsing complex spoken splitting rules, calculating proportional taxes/discounts with zero rounding leaks, and sharing 1-tap payment links.

### System Architecture Diagram

```
[ User Smartphone / Browser (React + TypeScript + Vite) ]
     │
     ├── 1. Receipt Input: Dual Mode
     │    ├── Live Camera Capture (Webcam / Device Camera stream)
     │    ├── Image File Upload (Drag & Drop / Gallery File Picker)
     │    └── "Load Demo Sample" (1-Click instant test)
     │
     ├── 2. Splitting Instructions Input: Multimodal (Voice OR Text)
     │    ├── Option A: Voice Input (Live Mic Recording) ──► ElevenLabs Scribe STT
     │    ├── Option B: Direct Text Input (Type or paste split instructions directly)
     │    └── Unified Editable Box (Review and edit transcribed or typed rules before submission)
     ▼
[ FastAPI Backend (Python) ]
     │
     ├── Step A: ElevenLabs Scribe STT ───────────► (If voice input used) High-accuracy text transcript
     ├── Step B: Hugging Face Gemma (PaliGemma/Gemma 2) ──► Receipt line items & tax schema
     ├── Step C: TabPFN-3.5 Anomaly Guardian ────► Outlier price/tax validation & tip model
     ├── Step D: Hugging Face Gemma (Reasoning) ──► Semantic Rule-to-Item Allocation Matrix
     ├── Step E: Deterministic Math Engine (Decimal) ──► Exact zero-leakage share settlement
     └── Step F: Sentry Agent Tracing ───────────► Full latency, token & error telemetry
     │
     ▼
[ Direct In-App Settlement Dashboard (React UI) ]
     * NO external ElevenLabs TTS page / No redirect *
     ├── Live Generated Bill Breakdown (Merchant, items, taxes, discounts, grand total)
     ├── Interactive Tappable Item Chips (Instant participant reassignment & live recalculation)
     ├── Participant Settlement Cards (Individual subtotals, tax/tip shares, and net owed)
     ├── 1-Tap UPI Payment Deep Links (`upi://pay`) & Live Dynamic QR Codes
     ├── Optional In-Place Audio Playback (Listen to bill breakdown directly on page)
     └── Shareable WhatsApp Itemized Card Export (`html-to-image`)
```

---

## 2. Technology Stack & Hackathon Tracks

### Core Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18+ (TypeScript), Vite, Tailwind CSS, Axios | Mobile-first UI with camera capture, file upload, voice recording, direct text input, interactive chips, and in-app bill settlement |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 | High-performance asynchronous API, CORS, and request validation |
| **Math Engine** | Python `decimal.Decimal` (Round Half Up) | Proportional taxes/discounts and penny-rounding delta resolution |
| **Receipt Vision & OCR** | Hugging Face (`google/paligemma-2-3b-pt-448` or `google/gemma-2-9b-it`) | Multimodal receipt line-item, tax, and discount extraction |
| **Voice Transcription (STT)**| ElevenLabs Scribe STT (`scribe_v1`) | Ultra-fast transcription of conversational splitting rules (for voice input mode) |
| **Direct Text Input** | Native Textarea with Prompt Suggestions | Direct typing or editing of split instructions without microphone access |
| **Semantic Rule Reasoner** | Hugging Face (`google/gemma-2-9b-it`) | Interprets conversational nicknames, exclusions, and weights from voice or text |
| **Tabular Anomaly Detector** | Prior Labs TabPFN-3.5 | Detects OCR parsing anomalies and predicts fair tips/spending |
| **In-Place Voice Feedback** | ElevenLabs TTS (Optional in-page audio stream) | Embedded in-page audio summary player (no external page navigation) |
| **Observability** | Sentry SDK (Agent Tracing & LLM Spans) | Tracing Gemma & ElevenLabs token usage, latency, and pipeline errors |
| **Card Export** | `html-to-image` (Canvas) | Generates shareable image breakdown for WhatsApp / messaging apps |

### Hackathon Sponsor Tracks Matrix

| Sponsor Track | Prize | Integration Point |
| :--- | :--- | :--- |
| **Gemma** | **$200** | Receipt vision OCR extraction & voice-to-item allocation reasoning. |
| **Prior Labs (TabPFN)** | **$200** | Scans extracted receipt items for price anomalies & predicts tip percentages. |
| **Render / DigitalOcean** | **$200** | Deployment of FastAPI backend and React static build. |
| **ElevenLabs** | **$100** | Scribe STT for voice memo transcription + optional in-place audio settlement player. |
| **Sentry** | **$100** | Sentry Agent Tracing capturing LLM tokens, latency, and pipeline spans. |
| **Temporal** | **$100** | Durable workflow orchestration for multi-step retry & payment reminder timers. |
| **.tech Domains** | **$100** | Live deployment under custom `.tech` domain (e.g. `chaoticsplitter.tech`). |

---

## 3. Repository Directory Structure

```
chaoticSplitter/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app entry point & CORS configuration
│   │   ├── config.py                # Environment settings (HF, ElevenLabs, TabPFN, Sentry)
│   │   ├── schemas.py               # Pydantic schemas (Receipt, VoicePlan, Settlement)
│   │   ├── math_engine.py           # Deterministic Python Decimal settlement calculator
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── ocr_service.py       # Hugging Face Gemma receipt extractor
│   │   │   ├── voice_service.py     # ElevenLabs Scribe STT & TTS announcer
│   │   │   ├── reasoning_service.py # Gemma semantic rule allocation mapper
│   │   │   ├── anomaly_service.py   # Prior Labs TabPFN-3.5 anomaly & tip predictor
│   │   │   └── telemetry.py         # Sentry agent tracing setup
│   │   └── samples/
│   │       ├── sample_receipt.jpg   # Bundled sample receipt for 1-click test
│   │       └── sample_voice.webm    # Bundled sample voice audio memo
│   ├── tests/
│   │   ├── test_math_engine.py      # Zero-leakage penny-rounding test suite
│   │   └── test_schemas.py          # Pydantic schema validation tests
│   ├── requirements.txt             # Python dependencies
│   └── .env.example                 # Backend environment variable template
│
├── frontend/
│   ├── public/                      # Static assets & sample audio/images
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Header.tsx           # Navigation bar & group presets selector
│   │   │   ├── ReceiptInput.tsx     # Step 1: Live camera capture + image file upload + sample loader
│   │   │   ├── InstructionInput.tsx # Step 2: Voice memo (mic/upload) OR direct text input
│   │   │   ├── ReceiptTable.tsx     # Step 3: Interactive item list with colored participant pills
│   │   │   ├── SettlementDashboard.tsx # Step 4: Direct in-app bill breakdown, UPI QR codes, & cards
│   │   │   ├── WhatsAppExport.tsx   # Shareable receipt card export via html-to-image
│   │   │   └── AnomalyBanner.tsx    # TabPFN warning banner if anomalies/mismatches found
│   │   ├── services/
│   │   │   └── api.ts               # Axios / Fetch client to FastAPI endpoints
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces mirroring backend schemas
│   │   ├── App.tsx                  # Main 4-stage stepper UI state machine
│   │   ├── index.css                # Tailwind CSS / theme tokens
│   │   └── main.tsx                 # React DOM mount
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── plan.md                          # This master execution plan
└── README.md                        # Hackathon submission overview & setup guide
```

---

## 4. Phased Implementation Roadmap

### Phase 1: Environment & Scaffolding
- [ ] **1.1 Backend Setup**:
  - Initialize `backend/` with Python virtual environment.
  - Create `requirements.txt` with `fastapi`, `uvicorn`, `pydantic`, `huggingface_hub`, `elevenlabs`, `tabpfn`, `sentry-sdk`, `python-dotenv`, `python-multipart`.
  - Create `backend/app/config.py` loading API keys safely.
- [ ] **1.2 Frontend Setup**:
  - Scaffold `frontend/` using Vite with React + TypeScript template.
  - Install and configure Tailwind CSS, `html-to-image`, `axios` (clean custom SVG icons).
  - Establish color palette (dark mode with glassmorphic cards and vibrant emerald/amber/indigo accent pills).
- [ ] **1.3 Mock Data & End-to-End Contract**:
  - Define shared TypeScript interfaces and Pydantic schemas.
  - Create mock fixtures for instant local testing without exhausting external API credits.

---

### Phase 2: Deterministic Math & Settlement Engine (`math_engine.py`)
- [ ] **2.1 Precision Foundation**:
  - Use `decimal.Decimal` with `ROUND_HALF_UP` for all calculations.
- [ ] **2.2 Proportional Calculation Algorithm**:
  - For each line item: compute each consumer's fractional share: `(weight / sum_of_weights) * item_price`.
  - Compute subtotal per person.
  - Proportional tax: `person_tax = (person_subtotal / total_subtotal) * total_tax`.
  - Proportional tip / service charge: `person_tip = (person_subtotal / total_subtotal) * total_service_charge`.
  - Proportional discount: `person_discount = (person_subtotal / total_subtotal) * total_discount`.
- [ ] **2.3 Zero-Leakage Rounding Solver**:
  - `sum(rounded_shares) == grand_total` must strictly equal `True`.
  - Calculate remainder delta: `delta = grand_total - sum(individual_rounded_totals)`.
  - Allocate the delta (+0.01 or -0.01) to the participant with the largest subtotal share.
- [ ] **2.4 Edge Cases**:
  - Unclaimed items: Automatically route into an equal split across all participants.
  - Unit tests in `backend/tests/test_math_engine.py` verifying 100% precision across diverse bill totals.

---

### Phase 3: AI Pipeline Integration
- [ ] **3.1 Hugging Face Gemma Receipt Vision OCR (`ocr_service.py`)**:
  - Send receipt image bytes to Hugging Face (`google/paligemma-2-3b-pt-448` or `google/gemma-2-9b-it`).
  - Constrain response to strict `ReceiptSchema` (items, quantities, subtotal, tax, service charge, discounts, grand total).
  - Add fallback sample extractor for instant offline hackathon demos.
- [ ] **3.2 ElevenLabs Scribe Speech-to-Text (`voice_service.py`)**:
  - (When voice option is used) Transcribe audio bytes from live mic or uploaded audio file.
  - Invoke `eleven_client.speech_to_text.convert(file=audio_bytes, model_id="scribe_v1")`.
  - Return clean textual transcript with punctuation into the editable instruction box.
- [ ] **3.3 Hugging Face Gemma Semantic Rule Reasoner (`reasoning_service.py`)**:
  - Build prompt containing receipt item IDs, dish names, and the spoken transcript or typed text instructions.
  - Parse participants, dish assignments, weights, and exclusion logic.
  - Validate output against `VoiceSplitPlan` schema.
- [ ] **3.4 Prior Labs TabPFN Anomaly Guardian (`anomaly_service.py`)**:
  - Feed extracted receipt line item table into `TabPFNClassifier` / `TabPFNRegressor`.
  - Check for anomalous price outliers (e.g. OCR misreading `₹12` as `₹120`).
  - Predict suggested fair tip percentage based on group size and bill total.
- [ ] **3.5 In-Place Voice Feedback (`voice_service.py`)**:
  - Optional in-page TTS audio synthesis (streamed back to React for in-place audio player; no external page navigation).
- [ ] **3.6 Sentry Agent Tracing (`telemetry.py`)**:
  - Initialize Sentry with performance & AI agent monitoring.
  - Create spans for OCR extraction, STT transcription, Gemma reasoning, and math engine execution.

---

### Phase 4: FastAPI REST Endpoints (`main.py`)
- [ ] **4.1 Endpoints**:
  - `POST /api/receipt/extract`: Uploads receipt image (camera snapshot or file upload) -> returns `ReceiptSchema` + TabPFN anomaly report.
  - `POST /api/voice/transcribe`: (Optional) Uploads audio blob (mic or audio upload) -> returns text transcript via ElevenLabs Scribe.
  - `POST /api/split/plan`: Takes `ReceiptSchema` + `instructions: str` (from voice transcript or direct typing) -> returns `VoiceSplitPlan` via Gemma.
  - `POST /api/split/calculate`: Takes `ReceiptSchema` + `VoiceSplitPlan` (with any user manual overrides) -> returns exact `SettlementSummary` to display directly in the UI.
  - `POST /api/voice/announce`: Generates in-place audio stream for the optional UI audio widget.
  - `GET /api/sample`: Returns pre-bundled receipt and voice memo for 1-click evaluation.

---

### Phase 5: React TypeScript Frontend (`frontend/`)
- [ ] **5.1 Stepper Architecture**:
  - **Stage 1 (Receipt Input - Dual Mode)**:
    - **Live Camera Capture**: Real-time webcam/device camera stream with a shutter button to freeze and crop receipt image.
    - **Image File Upload**: Drag-and-drop zone or gallery file selector (`.jpg`, `.png`, `.webp`, `.heic`).
    - **"Load Demo Sample"**: 1-click button for instant offline evaluation.
  - **Stage 2 (Splitting Instructions - Voice OR Text Input)**:
    - **Voice Input Mode**:
      - Live Microphone recording button with Web Audio API waveform visualizer and timer.
      - Audio file upload (`.wav`, `.mp3`, `.m4a`, `.webm`).
      - Automatic transcription via ElevenLabs Scribe that populates the instruction text box.
    - **Direct Text Input Mode**:
      - Prompt textarea allowing users to directly type or paste split instructions without needing a microphone.
      - Sample quick-prompts (e.g., *"Me and Rahul shared the pizza, Neha only had iced latte, apply 15% discount"*).
    - **Unified Review & Edit**: Transcribed voice notes appear in the same textarea, allowing users to make quick edits before running Gemma.
  - **Stage 3 (Interactive Verify & Override)**:
    - Clean table view of extracted receipt items, prices, and detected discounts/taxes.
    - Colored participant pills beside each line item. Tapping a pill instantly toggles a participant on/off with real-time math recalculation.
    - Amber warning banners if TabPFN detects anomalous item values or OCR subtotal discrepancies.
  - **Stage 4 (Direct In-App Settlement Dashboard)**:
    - **Full in-UI presentation (No external TTS redirect / No external page)**:
    - **Itemized Bill Summary**: Clear view of items, subtotals, tax/tip/discount breakdown, and reconciled grand total.
    - **Participant Settlement Cards**: Exactly what each friend owes with itemized tags.
    - **1-Tap UPI Deep Links** (`upi://pay?pa=<vpa>&am=<amount>&pn=<name>`) and live dynamic QR codes.
    - **WhatsApp Shareable Card**: 1-click export of an itemized graphical card using `html-to-image`.
    - **Optional In-Place Audio Player**: Mini audio player widget right inside the settlement dashboard to hear the breakdown.
- [ ] **5.2 Polish & User Experience**:
  - Modern typography (Inter / Outfit) with sleek dark mode aesthetics.
  - Group presets stored in `localStorage` (friends' names and UPI IDs) for 1-click pre-selection.

---

### Phase 6: Verification, Testing & Polish
- [ ] **6.1 Zero-Leakage Math Audit**:
  - Verify across 20+ test scenarios that the sum of all individual payments precisely matches `grand_total` to the penny.
- [ ] **6.2 Offline / Demo Resilience**:
  - Ensure sample mode works smoothly even if external API keys hit rate limits during live judge evaluations.
- [ ] **6.3 Sentry Agent Tracing Verification**:
  - Verify traces appear on Sentry dashboard with complete token counts and timing waterfalls. Capture screenshots for write-up.

---

### Phase 7: Deployment & Submission
- [ ] **7.1 Deploy to Render / DigitalOcean**:
  - Backend deployed as Web Service on Render or DigitalOcean Droplet.
  - Frontend deployed on Render Static Sites / Vercel with custom `.tech` domain.
- [ ] **7.2 Project Write-Up & Video**:
  - Document the architecture, sponsor integrations, Sentry traces, and live link.
  - Use ElevenLabs narration for the demo video.

---

## 5. Data Contracts & Pydantic Schemas

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class LineItem(BaseModel):
    item_id: int = Field(description="Sequential integer starting from 1")
    name: str = Field(description="Clean item or dish name")
    quantity: int = Field(default=1)
    total_price: float = Field(description="Total line price for this quantity")

class ReceiptSchema(BaseModel):
    merchant_name: str
    currency: str = Field(default="INR")
    items: List[LineItem]
    subtotal: float
    tax_total: float = Field(default=0.0)
    service_charge_or_tip: float = Field(default=0.0)
    discount_total: float = Field(default=0.0)
    grand_total: float

class ItemShare(BaseModel):
    item_id: int
    person: str
    weight: float = Field(default=1.0, description="Relative consumption weight")

class SplitPlanRequest(BaseModel):
    receipt: ReceiptSchema
    instructions: str = Field(description="Natural language splitting rules from voice transcript or direct text typing")

class VoiceSplitPlan(BaseModel):
    participants: List[str]
    allocations: List[ItemShare]
    unclaimed_rule: str = Field(default="split_all")
    reasoning_summary: str

class ParticipantShare(BaseModel):
    person: str
    subtotal: float
    tax_share: float
    tip_share: float
    discount_share: float
    final_total: float
    upi_link: Optional[str] = None
    items_consumed: List[str]

class SettlementSummary(BaseModel):
    grand_total: float
    sum_of_shares: float
    zero_leakage_verified: bool
    participants: List[ParticipantShare]
    rounding_adjustment_cents: float
    tabpfn_anomaly_alert: Optional[str] = None
    suggested_tip_percentage: Optional[float] = None
```

---

## 6. Environment Configuration (`.env.example`)

```bash
# Hugging Face (Gemma 2 / PaliGemma 2)
HF_TOKEN=hf_your_token_here

# ElevenLabs (Scribe STT + Voice TTS)
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# Prior Labs (TabPFN-3.5)
TABPFN_API_KEY=your_priorlabs_key_here

# Sentry Observability & Agent Tracing
SENTRY_DSN=https://your_sentry_dsn_here

# Application Configuration
PORT=8000
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```