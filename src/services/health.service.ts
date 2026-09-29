import type { HealthResponse } from '../interfaces/health.interface';

export function getHealth(): HealthResponse {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
