import { checkBackendHealth } from '../services/api';
import { getErrorMessage } from './errorHandler';

export type ConnectionStatus = 'checking' | 'connected' | 'error';

export interface ConnectionResult {
  status: ConnectionStatus;
  message: string;
}

/**
 * Pings the backend health endpoint and returns a unified status and friendly message.
 */
export async function pingBackendService(): Promise<ConnectionResult> {
  try {
    const data = await checkBackendHealth();
    return {
      status: 'connected',
      message: data?.message || 'FastAPI Backend online!',
    };
  } catch (err: unknown) {
    return {
      status: 'error',
      message: getErrorMessage(err),
    };
  }
}
