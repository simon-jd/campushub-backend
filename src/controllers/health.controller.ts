import type { Request, Response } from 'express';
import type { ApiSuccess } from '../interfaces/api-response.interface';
import type { HealthResponse } from '../interfaces/health.interface';
import { getHealth } from '../services/health.service';

export function healthController(
  _request: Request<Record<string, string>, ApiSuccess<HealthResponse>, unknown>,
  response: Response<ApiSuccess<HealthResponse>>,
): void {
  response.status(200).json({ success: true, data: getHealth() });
}
