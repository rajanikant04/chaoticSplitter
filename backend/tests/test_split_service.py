import unittest
from unittest.mock import MagicMock, patch
from app.services.split_service import generate_split_plan_with_gemma, _fallback_equal_split
from app.schemas import SplitPlanRequest, ReceiptSchema, LineItem, VoiceSplitPlan

class TestSplitService(unittest.TestCase):
    def setUp(self):
        self.sample_receipt = ReceiptSchema(
            merchant_name="Bawarchi",
            currency="INR",
            items=[
                LineItem(item_id=1, name="Butter Naan", quantity=2, total_price=160.0),
                LineItem(item_id=2, name="Chicken Biryani", quantity=1, total_price=450.0),
                LineItem(item_id=3, name="Coke", quantity=2, total_price=80.0)
            ],
            subtotal=690.0,
            tax_total=34.5,
            service_charge_or_tip=0.0,
            discount_total=0.0,
            grand_total=724.5
        )
        self.members = ["Alice", "Bob", "Charlie"]

    def test_fallback_equal_split_empty_instructions(self):
        req = SplitPlanRequest(
            receipt=self.sample_receipt,
            instructions="",
            members=self.members,
            unclaimed_rule="split_all"
        )
        plan = generate_split_plan_with_gemma(req)
        self.assertIsInstance(plan, VoiceSplitPlan)
        self.assertEqual(len(plan.participants), 3)
        # 3 items * 3 members = 9 allocations
        self.assertEqual(len(plan.allocations), 9)
        self.assertEqual(plan.unclaimed_rule, "split_all")

    @patch("requests.post")
    def test_generate_split_plan_mock_gemma(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {
                "content": """{
                    "participants": ["Alice", "Bob", "Charlie"],
                    "allocations": [
                        {"item_id": 1, "person": "Alice", "weight": 1.0},
                        {"item_id": 1, "person": "Bob", "weight": 1.0},
                        {"item_id": 2, "person": "Charlie", "weight": 1.0},
                        {"item_id": 3, "person": "Alice", "weight": 1.0},
                        {"item_id": 3, "person": "Bob", "weight": 1.0},
                        {"item_id": 3, "person": "Charlie", "weight": 1.0}
                    ],
                    "unclaimed_rule": "split_all",
                    "reasoning_summary": "Alice and Bob shared naan, Charlie had biryani, all shared coke."
                }"""
            }
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        req = SplitPlanRequest(
            receipt=self.sample_receipt,
            instructions="Alice and Bob shared naan, Charlie had biryani, everyone shared coke",
            members=self.members,
            unclaimed_rule="split_all"
        )

        plan = generate_split_plan_with_gemma(req)
        self.assertIsInstance(plan, VoiceSplitPlan)
        self.assertEqual(plan.participants, ["Alice", "Bob", "Charlie"])
        self.assertEqual(len(plan.allocations), 6)
        self.assertEqual(plan.unclaimed_rule, "split_all")
        self.assertIn("Alice", plan.reasoning_summary)

if __name__ == "__main__":
    unittest.main()
