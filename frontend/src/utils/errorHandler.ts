import axios from 'axios';

/**
 * Extracts a user-friendly error message from any caught error,
 * including Axios errors (FastAPI detail, validation errors, network failure),
 * standard JavaScript Errors, or unknown objects.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // 1. Backend returned an error response (4xx, 5xx)
    if (error.response?.data) {
      const data = error.response.data;

      // FastAPI default error format: { detail: "message" } or { detail: [{ msg: "..." }] }
      if (typeof data === 'string') {
        return data;
      }

      if (data.detail) {
        if (typeof data.detail === 'string') {
          return data.detail;
        }

        // Pydantic validation error array
        if (Array.isArray(data.detail)) {
          return data.detail
            .map((err: { msg?: string; loc?: string[] }) => err.msg || JSON.stringify(err))
            .join(', ');
        }

        return JSON.stringify(data.detail);
      }

      if (data.message) {
        return String(data.message);
      }
    }

    // 2. Request was made but no response was received (server down, timeout, CORS)
    if (error.request) {
      if (error.code === 'ECONNABORTED') {
        return 'Request timed out. Please try again.';
      }
      return 'Unable to reach backend server. Please verify the server is running on port 8000.';
    }

    // 3. Other Axios setup errors
    return error.message || 'An unexpected network error occurred.';
  }

  // Standard JavaScript Error
  if (error instanceof Error) {
    return error.message;
  }

  // Fallback string representation
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}
