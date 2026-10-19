import axios from 'axios';

// Configure base URL: in production uses VITE_API_BASE_URL; in local dev defaults to '' (proxied by Vite)
if (import.meta.env.VITE_API_BASE_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL;
}

// Health check to test frontend-backend integration
export async function checkBackendHealth() {
  const res = await axios.get('/api/health');
  return res.data;
}

export interface GroupParseResult {
  group_name: string;
  members: string[];
  transcript: string;
}

// Stage 0: Sends audio recording to /api/groups which transcribes via ElevenLabs & extracts JSON via Gemma 4
export async function parseGroupAudio(audioBlob: Blob): Promise<GroupParseResult> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'group_memo.webm');

  const res = await axios.post<GroupParseResult>('/api/groups', formData);
  return res.data;
}

// --- Stage 1: Receipt Data Models ---
export interface LineItem {
  item_id: number;
  name: string;
  quantity: number;
  total_price: number;
}

export interface ReceiptData {
  merchant_name: string;
  currency: string;
  items: LineItem[];
  subtotal: number;
  tax_total: number;
  service_charge_or_tip: number;
  discount_total: number;
  grand_total: number;
}

// Upload receipt image to /api/receipts for extraction
export async function uploadReceiptImage(imageFile: File): Promise<ReceiptData> {
  const formData = new FormData();
  formData.append('file', imageFile);

  const res = await axios.post<ReceiptData>('/api/receipts', formData);
  return res.data;
}

// Transcribe audio using /api/transcribe
export async function transcribeAudio(audioBlob: Blob): Promise<{ transcript: string }> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'mic_recording.webm');

  const res = await axios.post<{ transcript: string }>('/api/transcribe', formData);
  return res.data;
}

// --- Stage 2: Splitting Rules & Allocation Models ---
export interface ItemShare {
  item_id: number;
  person: string;
  weight: number;
}

export interface SplitPlanRequest {
  receipt: ReceiptData;
  instructions: string;
  members: string[];
  unclaimed_rule?: string;
}

export interface VoiceSplitPlan {
  participants: string[];
  allocations: ItemShare[];
  unclaimed_rule?: string;
  reasoning_summary: string;
}

// Generate AI Split Plan by calling POST /api/split-plan
export async function generateSplitPlan(
  receipt: ReceiptData,
  instructions: string,
  members: string[],
  unclaimed_rule: string = 'split_all'
): Promise<VoiceSplitPlan> {
  const payload: SplitPlanRequest = {
    receipt,
    instructions,
    members,
    unclaimed_rule,
  };
  const res = await axios.post<VoiceSplitPlan>('/api/split-plan', payload);
  return res.data;
}

// --- Stage 3: Settlement & Math Engine Models ---
export interface ParticipantShare {
  person: string;
  subtotal: number;
  tax_share: number;
  tip_share: number;
  discount_share: number;
  final_total: number;
  upi_link?: string | null;
  qr_code_data_url?: string | null;
  items_consumed: string[];
}

export interface SettlementSummary {
  merchant_name: string;
  currency: string;
  grand_total: number;
  sum_of_shares: number;
  zero_leakage_verified: boolean;
  rounding_adjustment_cents: number;
  participants: ParticipantShare[];
  unclaimed_items: string[];
}

export interface CalculateSettlementRequest {
  receipt: ReceiptData;
  plan: VoiceSplitPlan;
  payer_name?: string;
  payer_upi_vpa?: string;
}

// Call POST /api/verify to execute deterministic Python math engine
export async function verifyAndCalculateSettlement(
  payload: CalculateSettlementRequest
): Promise<SettlementSummary> {
  const res = await axios.post<SettlementSummary>('/api/verify', payload);
  return res.data;
}

// Call POST /api/settle to calculate final settlement and generate participant QR codes
export async function settleAndGeneratePayments(
  payload: CalculateSettlementRequest
): Promise<SettlementSummary> {
  const res = await axios.post<SettlementSummary>('/api/settle', payload);
  return res.data;
}