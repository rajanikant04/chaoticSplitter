import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import ReceiptSchema, LineItem, VoiceSplitPlan, ItemShare
from app.math_engine import compute_settlement

client = TestClient(app)

class TestVerifyEndpointAndMathEngine(unittest.TestCase):
    def setUp(self):
        self.sample_receipt = ReceiptSchema(
            merchant_name="Spice Kitchen",
            currency="INR",
            items=[
                LineItem(item_id=1, name="Paneer Tikka", quantity=1, total_price=300.0),
                LineItem(item_id=2, name="Butter Chicken", quantity=1, total_price=450.0),
                LineItem(item_id=3, name="Garlic Naan", quantity=3, total_price=150.0),
            ],
            subtotal=900.0,
            tax_total=45.0,
            service_charge_or_tip=50.0,
            discount_total=95.0,
            grand_total=900.0,
        )
        self.sample_plan = VoiceSplitPlan(
            participants=["Alice", "Bob", "Charlie"],
            allocations=[
                ItemShare(item_id=1, person="Alice", weight=1.0),
                ItemShare(item_id=2, person="Bob", weight=1.0),
                ItemShare(item_id=3, person="Alice", weight=1.0),
                ItemShare(item_id=3, person="Bob", weight=1.0),
                ItemShare(item_id=3, person="Charlie", weight=1.0),
            ],
            unclaimed_rule="split_all",
            reasoning_summary="Alice had Paneer, Bob had Chicken, all shared Naan.",
        )

    def test_direct_compute_settlement_zero_leakage(self):
        summary = compute_settlement(
            receipt=self.sample_receipt,
            plan=self.sample_plan,
            payer_name="Alice",
            payer_upi_vpa="alice@upi",
        )
        self.assertTrue(summary.zero_leakage_verified)
        self.assertAlmostEqual(summary.sum_of_shares, summary.grand_total, places=2)
        self.assertEqual(len(summary.participants), 3)

    def test_verify_endpoint(self):
        payload = {
            "receipt": self.sample_receipt.model_dump(),
            "plan": self.sample_plan.model_dump(),
            "payer_name": "Alice",
            "payer_upi_vpa": "alice@upi",
        }
        response = client.post("/api/verify", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["zero_leakage_verified"])
        self.assertEqual(data["merchant_name"], "Spice Kitchen")
        self.assertEqual(len(data["participants"]), 3)

    def test_unmentioned_items_split_evenly(self):
        # Plan without allocation for item 3 (Garlic Naan, 150.0)
        plan_partial = VoiceSplitPlan(
            participants=["Alice", "Bob", "Charlie"],
            allocations=[
                ItemShare(item_id=1, person="Alice", weight=1.0),
                ItemShare(item_id=2, person="Bob", weight=1.0),
            ],
            reasoning_summary="Paneer to Alice, Chicken to Bob.",
        )
        summary = compute_settlement(
            receipt=self.sample_receipt,
            plan=plan_partial,
            payer_name="Alice",
        )
        self.assertTrue(summary.zero_leakage_verified)
        # Garlic Naan (₹150) unmentioned should be in unclaimed_items and split evenly (₹50 each)
        self.assertEqual(len(summary.unclaimed_items), 1)
        self.assertIn("Garlic Naan", summary.unclaimed_items[0])
        # Each participant should have 50.0 subtotal added from Garlic Naan
        # Alice subtotal: 300 + 50 = 350
        # Bob subtotal: 450 + 50 = 500
        # Charlie subtotal: 0 + 50 = 50
        shares_by_person = {p.person: p.subtotal for p in summary.participants}
        self.assertAlmostEqual(shares_by_person["Alice"], 350.0)
        self.assertAlmostEqual(shares_by_person["Bob"], 500.0)
        self.assertAlmostEqual(shares_by_person["Charlie"], 50.0)

    def test_settle_endpoint_with_qr_code(self):
        payload = {
            "receipt": self.sample_receipt.model_dump(),
            "plan": self.sample_plan.model_dump(),
            "payer_name": "Alice",
            "payer_upi_vpa": "alice@okhdfcbank",
        }
        response = client.post("/api/settle", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["zero_leakage_verified"])
        
        # Non-payer participants (Bob and Charlie) must have upi_link and qr_code_data_url
        non_payers = [p for p in data["participants"] if p["person"] != "Alice"]
        self.assertEqual(len(non_payers), 2)
        for np in non_payers:
            self.assertIsNotNone(np["upi_link"])
            self.assertTrue(np["upi_link"].startswith("upi://pay?"))
            self.assertIsNotNone(np["qr_code_data_url"])
            self.assertTrue(np["qr_code_data_url"].startswith("data:image/png;base64,"))


