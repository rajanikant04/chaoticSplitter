from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple
import urllib.parse
import io
import base64
import qrcode

from app.schemas import (
    ReceiptSchema,
    VoiceSplitPlan,
    SettlementSummary,
    ParticipantShare,
    ItemShare,
)
from app.services.anomaly_service import audit_receipt_with_tabpfn
from app.telemetry import trace_span

TWO_PLACES = Decimal("0.01")

def to_decimal(val: float | int | str) -> Decimal:
    """Helper to convert values safely to Decimal."""
    return Decimal(str(val))

def round_cents(d: Decimal) -> Decimal:
    """Rounds a Decimal to standard 2 decimal places using ROUND_HALF_UP."""
    return d.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

def generate_upi_link(
    payer_vpa: str,
    payer_name: str,
    amount: float,
    merchant_name: str = "Dinner Split",
) -> str:
    """Generates standard UPI deep link for 1-tap payment in India."""
    params = {
        "pa": payer_vpa,
        "pn": payer_name,
        "am": f"{amount:.2f}",
        "cu": "INR",
        "tn": f"Bill Split - {merchant_name}",
    }
    return f"upi://pay?{urllib.parse.urlencode(params)}"

def generate_qr_code_base64(data: str) -> str:
    """Generates a base64 encoded PNG data URL for a given UPI string."""
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=2,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        try:
            img.save(buffered, format="PNG")
        except TypeError:
            img.save(buffered)
        b64_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_str}"
    except Exception as e:
        return ""

def compute_settlement(
    receipt: ReceiptSchema,
    plan: VoiceSplitPlan,
    payer_name: str = "Me",
    payer_upi_vpa: str = None,
) -> SettlementSummary:
    """
    Deterministic bill settlement calculator.
    Guarantees:
      1. Proportional distribution of taxes, tips, and discounts.
      2. Zero-leakage rounding (sum of individual shares == receipt grand total).
      3. Automatic routing of unclaimed items to all participants.
      4. Prior Labs TabPFN Anomaly & Outlier validation.
      5. Distributed performance tracing via Sentry spans.
    """
    with trace_span("math.settlement", "Zero-Leakage Decimal Settlement Engine", {
        "merchant": receipt.merchant_name,
        "items_count": len(receipt.items),
        "grand_total": float(receipt.grand_total),
    }):
        # 1. Normalize participants
        participants = list(dict.fromkeys(plan.participants))
        if not participants:
            participants = ["Me"]

    # Map item_id -> list of allocations
    allocations_by_item: Dict[int, List[ItemShare]] = {}
    for alloc in plan.allocations:
        allocations_by_item.setdefault(alloc.item_id, []).append(alloc)

    # Participant subtotals & itemized food descriptions
    person_subtotals: Dict[str, Decimal] = {p: Decimal("0.00") for p in participants}
    person_items: Dict[str, List[str]] = {p: [] for p in participants}
    unclaimed_items: List[str] = []

    # 2. Allocate each line item
    for item in receipt.items:
        item_price = to_decimal(item.total_price)
        allocs = allocations_by_item.get(item.item_id, [])

        if not allocs:
            # Unclaimed / unmentioned item: always split equally among all participants
            unclaimed_items.append(f"{item.name} (₹{item.total_price})")
            share_weight = Decimal("1.0") / Decimal(str(len(participants)))
            for p in participants:
                person_subtotals[p] += item_price * share_weight
                person_items[p].append(f"{item.name} (shared equally)")
        else:
            # Item has explicit allocations
            total_weight = sum(to_decimal(a.weight) for a in allocs)
            if total_weight <= Decimal("0"):
                total_weight = Decimal("1.0")

            for alloc in allocs:
                p = alloc.person
                if p not in person_subtotals:
                    person_subtotals[p] = Decimal("0.00")
                    person_items[p] = []
                    participants.append(p)

                weight = to_decimal(alloc.weight)
                share_amount = item_price * (weight / total_weight)
                person_subtotals[p] += share_amount

                # Human-readable portion
                if weight == total_weight:
                    portion_str = item.name
                else:
                    portion_str = f"{item.name} ({weight}/{total_weight} share)"
                person_items[p].append(portion_str)

    # Total calculated subtotal from items
    total_calculated_subtotal = sum(person_subtotals.values())
    if total_calculated_subtotal <= Decimal("0"):
        total_calculated_subtotal = Decimal("1.0")

    total_tax = to_decimal(receipt.tax_total)
    total_tip = to_decimal(receipt.service_charge_or_tip)
    total_discount = to_decimal(receipt.discount_total)
    grand_total_dec = to_decimal(receipt.grand_total)

    # 3. Compute proportional taxes, tip, discount, and preliminary net total per person
    rounded_shares: Dict[str, Dict[str, Decimal]] = {}
    preliminary_totals: Dict[str, Decimal] = {}

    for p in participants:
        p_sub = person_subtotals[p]
        ratio = p_sub / total_calculated_subtotal

        p_tax = round_cents(total_tax * ratio)
        p_tip = round_cents(total_tip * ratio)
        p_discount = round_cents(total_discount * ratio)
        p_sub_rounded = round_cents(p_sub)

        p_total = p_sub_rounded + p_tax + p_tip - p_discount
        # Prevent negative totals
        if p_total < Decimal("0.00"):
            p_total = Decimal("0.00")

        rounded_shares[p] = {
            "subtotal": p_sub_rounded,
            "tax": p_tax,
            "tip": p_tip,
            "discount": p_discount,
        }
        preliminary_totals[p] = p_total

    # 4. Zero-Leakage Rounding Solver: Match grand total to the penny
    sum_rounded = sum(preliminary_totals.values())
    rounding_delta = grand_total_dec - sum_rounded

    # Allocate delta (+0.01 or -0.01) to the participant with the largest subtotal
    highest_spender = max(participants, key=lambda p: person_subtotals[p]) if participants else None
    if highest_spender and rounding_delta != Decimal("0.00"):
        preliminary_totals[highest_spender] += rounding_delta

    # 5. Build participant share models
    participant_models: List[ParticipantShare] = []
    for p in participants:
        shares = rounded_shares[p]
        final_amt = float(preliminary_totals[p])

        upi_link = None
        qr_code_data_url = None
        if payer_upi_vpa and p != payer_name and final_amt > 0:
            upi_link = generate_upi_link(
                payer_vpa=payer_upi_vpa,
                payer_name=payer_name,
                amount=final_amt,
                merchant_name=receipt.merchant_name,
            )
            qr_code_data_url = generate_qr_code_base64(upi_link)

        participant_models.append(
            ParticipantShare(
                person=p,
                subtotal=float(shares["subtotal"]),
                tax_share=float(shares["tax"]),
                tip_share=float(shares["tip"]),
                discount_share=float(shares["discount"]),
                final_total=final_amt,
                upi_link=upi_link,
                qr_code_data_url=qr_code_data_url,
                items_consumed=person_items[p],
            )
        )

        # 6. Verify zero leakage
        final_sum = sum(p.final_total for p in participant_models)
        zero_leakage = abs(final_sum - float(receipt.grand_total)) < 0.001

        # 7. Audit receipt with Prior Labs TabPFN
        audit = audit_receipt_with_tabpfn(receipt, len(participants))

        return SettlementSummary(
            merchant_name=receipt.merchant_name,
            currency=receipt.currency,
            grand_total=float(receipt.grand_total),
            sum_of_shares=round(final_sum, 2),
            zero_leakage_verified=zero_leakage,
            rounding_adjustment_cents=float(rounding_delta),
            participants=participant_models,
            unclaimed_items=unclaimed_items,
            tabpfn_anomaly_alert=audit.get("tabpfn_anomaly_alert"),
            suggested_tip_percentage=audit.get("suggested_tip_percentage"),
        )
