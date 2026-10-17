import unittest
from unittest.mock import MagicMock, patch
from app.services.ocr_service import parse_receipt_image
from app.schemas import ReceiptSchema

class TestOCRService(unittest.TestCase):
    @patch("requests.post")
    def test_parse_receipt_image_mock_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": """{
                "merchant_name": "Bawarchi Restaurant",
                "currency": "INR",
                "items": [
                    {"item_id": 1, "name": "Chicken Biryani", "quantity": 2, "total_price": 500.0},
                    {"item_id": 2, "name": "Butter Naan", "quantity": 4, "total_price": 160.0}
                ],
                "subtotal": 660.0,
                "tax_total": 33.0,
                "service_charge_or_tip": 0.0,
                "discount_total": 0.0,
                "grand_total": 693.0
            }"""
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        fake_image_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        result = parse_receipt_image(fake_image_bytes, filename="test_receipt.jpg")

        self.assertIsInstance(result, ReceiptSchema)
        self.assertEqual(result.merchant_name, "Bawarchi Restaurant")
        self.assertEqual(result.currency, "INR")
        self.assertEqual(len(result.items), 2)
        self.assertEqual(result.items[0].name, "Chicken Biryani")
        self.assertEqual(result.items[0].quantity, 2)
        self.assertEqual(result.items[0].total_price, 500.0)
        self.assertEqual(result.grand_total, 693.0)

if __name__ == "__main__":
    unittest.main()
