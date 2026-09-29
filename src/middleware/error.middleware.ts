import type { NextFunction, Request, Response } from 'express';
import type { ApiFailure } from '../interfaces/api-response.interface';

export function notFoundHandler(
  _request: Request<Record<string, string>, ApiFailure, unknown>,
  response: Response<ApiFailure>,
): void {
  response.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  });
}

export function errorHandler(
  error: unknown,
  _request: Request<Record<string, string>, ApiFailure, unknown>,
  response: Response<ApiFailure>,
  next: NextFunction,
): void {
  if (response.headersSent) {
    next(error);
    return;
  }

  console.error('Unhandled request error:', error);
  response.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}
