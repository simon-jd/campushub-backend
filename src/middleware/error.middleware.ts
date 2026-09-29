import type { NextFunction, Request, Response } from 'express';
import type { ErrorResponse } from '../types/reservation';
import { isRecord } from '../validation/reservation.validation';

export function notFoundHandler(
  _request: Request<Record<string, string>, ErrorResponse, unknown>,
  response: Response<ErrorResponse>,
): void {
  response.status(404).json({
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  });
}

export function errorHandler(
  error: unknown,
  _request: Request<Record<string, string>, ErrorResponse, unknown>,
  response: Response<ErrorResponse>,
  next: NextFunction,
): void {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (isRecord(error)) {
    if (error.type === 'entity.too.large') {
      response
        .status(413)
        .json({ code: 'PAYLOAD_TOO_LARGE', message: 'The JSON body exceeds the 16 KiB limit.' });
      return;
    }
    if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
      response
        .status(415)
        .json({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'The JSON encoding is unsupported.' });
      return;
    }
    if (
      error.type === 'entity.parse.failed' ||
      error.type === 'request.aborted' ||
      error.type === 'request.size.invalid' ||
      (error instanceof URIError && error.status === 400)
    ) {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid JSON or a malformed path.',
      });
      return;
    }
  }

  console.error(
    'Unhandled request error:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  response.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  });
}
