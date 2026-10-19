// Shared Data Contracts matching FastAPI Backend Schemas

export interface LineItem {
  item_id: number;
  name: string;
  quantity: number;
  total_price: number;
}

export interface ReceiptSchema {
  merchant_name: string;
  currency: string;
  items: LineItem[];
  subtotal: number;
  tax_total: number;
  service_charge_or_tip: number;
  discount_total: number;
  grand_total: number;
}

export interface ItemShare {
  item_id: number;
  person: string;
  weight: number;
}

export interface VoiceSplitPlan {
  participants: string[];
  allocations: ItemShare[];
  unclaimed_rule?: string;
  reasoning_summary: string;
}

export interface ParticipantShare {
  person: string;
  subtotal: number;
  tax_share: number;
  tip_share: number;
  discount_share: number;
  final_total: number;
  upi_link?: string | null;
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

export interface SampleDataResponse {
  receipt: ReceiptSchema;
  instructions: string;
  plan: VoiceSplitPlan;
  settlement: SettlementSummary;
}

export interface FriendPreset {
  id: string;
  name: string;
  upi_vpa?: string;
}
