import unittest
from unittest.mock import MagicMock, patch
from app.services.gemma_service import extract_group_with_gemma, _heuristic_group_parser

class TestGemmaService(unittest.TestCase):
    def test_heuristic_parser_with_keyword(self):
        transcript = "Goa trip with Alice, Bob, and Charlie"
        res = _heuristic_group_parser(transcript)
        self.assertEqual(res["group_name"], "Goa Trip")
        self.assertIn("Alice", res["members"])
        self.assertIn("Bob", res["members"])
        self.assertIn("Charlie", res["members"])

    def test_heuristic_parser_empty(self):
        res = extract_group_with_gemma("")
        self.assertEqual(res["group_name"], "Weekend Hangout")
        self.assertEqual(len(res["members"]), 2)

    @patch("requests.post")
    def test_ollama_api_mock(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"group_name": "Friday Dinner", "members": ["Rahul", "Priya", "Sam"]}'
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        res = extract_group_with_gemma("Friday dinner with Rahul Priya Sam")
        self.assertEqual(res["group_name"], "Friday Dinner")
        self.assertEqual(res["members"], ["Rahul", "Priya", "Sam"])

if __name__ == "__main__":
    unittest.main()
