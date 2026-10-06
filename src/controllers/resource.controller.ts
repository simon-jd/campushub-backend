import type { Request, Response } from 'express';
import { listResources } from '../services/resource.service';
import type { ErrorResponse, Resource } from '../types/reservation';
import { isResourceType } from '../validation/reservation.validation';

export async function listResourcesController(
  request: Request<Record<string, string>, Resource[] | ErrorResponse, unknown>,
  response: Response<Resource[] | ErrorResponse>,
): Promise<void> {
  const query = request.query;
  const type = query.type === 'STUDY_ROOM' ? 'ROOM' : query.type;
  if (
    Object.keys(query).some((key: string): boolean => key !== 'type') ||
    (type !== undefined && !isResourceType(type))
  ) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'type must be one of ROOM, EQUIPMENT, LAB, or STUDY_ROOM when provided.',
    });
    return;
  }
  response.status(200).json(await listResources(type));
}
