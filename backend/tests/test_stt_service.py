import unittest
from unittest.mock import MagicMock, patch
from app.services.stt_service import transcribe_audio_bytes

class TestSTTService(unittest.TestCase):
    def test_transcribe_missing_api_key(self):
        with patch("app.services.stt_service.ELEVENLABS_API_KEY", ""):
            with self.assertRaises(ValueError):
                transcribe_audio_bytes(b"dummy_audio_data")

    def test_transcribe_audio_mock_success(self):
        import sys
        fake_audio = b"RIFF....WAVEfmt...."
        mock_response = MagicMock()
        mock_response.text = "Alice paid for the drinks and Bob had pasta"
        mock_response.language_code = "eng"
        mock_response.duration = 4.2

        mock_eleven_module = MagicMock()
        mock_client_class = MagicMock()
        mock_instance = MagicMock()
        mock_instance.speech_to_text.convert.return_value = mock_response
        mock_client_class.return_value = mock_instance
        mock_eleven_module.client.ElevenLabs = mock_client_class

        with patch.dict(sys.modules, {"elevenlabs": mock_eleven_module, "elevenlabs.client": mock_eleven_module.client}):
            with patch("app.services.stt_service.ELEVENLABS_API_KEY", "test_valid_key"):
                res = transcribe_audio_bytes(fake_audio, filename="voice.wav")
                self.assertEqual(res.transcript, "Alice paid for the drinks and Bob had pasta")
                self.assertEqual(res.detected_language, "eng")
                self.assertEqual(res.duration_seconds, 4.2)

if __name__ == "__main__":
    unittest.main()
