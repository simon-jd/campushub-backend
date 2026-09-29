import type { Request, Response } from 'express';
import type { HealthResponse } from '../interfaces/health.interface';
import { getHealth } from '../services/health.service';

export function healthController(
  _request: Request<Record<string, string>, HealthResponse, unknown>,
  response: Response<HealthResponse>,
): void {
  response.status(200).json(getHealth());
}
