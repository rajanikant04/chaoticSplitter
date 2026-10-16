import axios from 'axios';

// Health check to test frontend-backend integration
export async function checkBackendHealth() {
  const res = await axios.get('/api/health');
  return res.data;
}