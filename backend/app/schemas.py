from pydantic import BaseModel, Field
from typing import List, Optional

# --- Stage 1: Receipt Data Models ---
class LineItem(BaseModel):
    item_id: int = Field(description="Sequential integer starting from 1")
    name: str = Field(description="Clean item or dish name")
    quantity: int = Field(default=1, description="Quantity ordered")
    total_price: float = Field(description="Total price for this line item (quantity * unit_price)")

class ReceiptSchema(BaseModel):
    merchant_name: str = Field(default="Restaurant", description="Name of the restaurant/merchant")
    currency: str = Field(default="INR", description="Currency code (e.g. INR, USD, EUR)")
    items: List[LineItem] = Field(default_factory=list, description="Extracted line items")
    subtotal: float = Field(description="Subtotal of items before taxes/discounts")
    tax_total: float = Field(default=0.0, description="Sum of CGST, SGST, VAT, or local taxes")
    service_charge_or_tip: float = Field(default=0.0, description="Service charge, gratuity, or tip")
    discount_total: float = Field(default=0.0, description="Absolute total of any discounts or promo vouchers")
    grand_total: float = Field(description="Final amount paid on the printed receipt")

# --- Stage 2: Splitting Rules & Allocation Models ---
class ItemShare(BaseModel):
    item_id: int = Field(description="Matching item_id from ReceiptSchema")
    person: str = Field(description="Name or avatar identifier of the participant")
    weight: float = Field(default=1.0, description="Relative consumption weight (e.g. 1.0 for equal split, 2.0 for 2 portions)")

class SplitPlanRequest(BaseModel):
    receipt: ReceiptSchema
    instructions: str = Field(description="Conversational splitting instructions from voice transcript or direct text typing")
    members: List[str] = Field(default_factory=list, description="List of participant names in the group")
    unclaimed_rule: str = Field(default="split_all", description="Unmentioned items rule: 'split_all' (default) or 'payer_only'")

class VoiceSplitPlan(BaseModel):
    participants: List[str] = Field(description="List of all unique participant names identified")
    allocations: List[ItemShare] = Field(description="Item-to-participant assignments with relative weights")
    unclaimed_rule: str = Field(default="split_all", description="How to handle unmentioned items: 'split_all' or 'payer_only'")
    reasoning_summary: str = Field(description="1-2 sentence human-readable summary of how the rules were mapped")

# --- Stage 3: Settlement & Payment Calculation Models ---
class CalculateSettlementRequest(BaseModel):
    receipt: ReceiptSchema
    plan: VoiceSplitPlan
    payer_name: Optional[str] = Field(default="Me", description="Name of the person who paid the restaurant bill")
    payer_upi_vpa: Optional[str] = Field(default=None, description="Payer's UPI ID (e.g. rahul@oksbi) to generate 1-tap links")

class ParticipantShare(BaseModel):
    person: str
    subtotal: float = Field(description="Raw subtotal of dishes consumed by this participant")
    tax_share: float = Field(description="Proportional share of taxes")
    tip_share: float = Field(description="Proportional share of tip / service charge")
    discount_share: float = Field(description="Proportional share of discounts (subtracted)")
    final_total: float = Field(description="Final net amount owed by this person")
    upi_link: Optional[str] = Field(default=None, description="1-Tap UPI deep link (upi://pay?...)")
    qr_code_data_url: Optional[str] = Field(default=None, description="Base64 Data URL for UPI QR code")
    items_consumed: List[str] = Field(default_factory=list, description="List of item names consumed with fractions")

class SettlementSummary(BaseModel):
    merchant_name: str
    currency: str
    grand_total: float
    sum_of_shares: float
    zero_leakage_verified: bool = Field(description="True if sum_of_shares strictly equals grand_total")
    rounding_adjustment_cents: float = Field(default=0.0, description="Delta (+0.01 or -0.01) allocated to highest spender")
    participants: List[ParticipantShare]
    unclaimed_items: List[str] = Field(default_factory=list, description="Items not mentioned and split equally")
    tabpfn_anomaly_alert: Optional[str] = Field(default=None, description="TabPFN outlier warning if detected")
    suggested_tip_percentage: Optional[float] = Field(default=None, description="TabPFN recommended fair tip percentage")

# --- Group Setup Audio Models ---
class GroupParseResponse(BaseModel):
    group_name: str = Field(description="Parsed group or event name")
    members: List[str] = Field(description="Parsed list of friend names")
    transcript: str = Field(description="Raw audio transcript from STT")

# --- Transcribe & Audio Feedback Models ---
class VoiceTranscribeResponse(BaseModel):
    transcript: str
    detected_language: Optional[str] = None
    duration_seconds: Optional[float] = None

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"

