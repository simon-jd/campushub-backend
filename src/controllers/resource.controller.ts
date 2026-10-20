import type { Request, Response } from 'express';
import type { ResourceFilter } from '../interfaces/resource-filter.interface';
import { listResources } from '../services/resource.service';
import type { ErrorResponse, Resource } from '../types/reservation';
import { isResourceType, parseBooleanLiteral } from '../validation/reservation.validation';

const SUPPORTED_FILTERS = ['type', 'isAvailable'];

export async function listResourcesController(
  request: Request<Record<string, string>, Resource[] | ErrorResponse, unknown>,
  response: Response<Resource[] | ErrorResponse>,
): Promise<void> {
  const query = request.query;
  if (Object.keys(query).some((key: string): boolean => !SUPPORTED_FILTERS.includes(key))) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Only the type and isAvailable query parameters are supported.',
    });
    return;
  }

  const filter: ResourceFilter = {};
  if (query.type !== undefined) {
    const type = query.type === 'STUDY_ROOM' ? 'ROOM' : query.type;
    if (!isResourceType(type)) {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'type must be exactly one of ROOM, EQUIPMENT, LAB, or STUDY_ROOM.',
      });
      return;
    }
    filter.type = type;
  }
  if (query.isAvailable !== undefined) {
    // A repeated parameter arrives as an array and fails here, keeping the filter unambiguous.
    const isAvailable = parseBooleanLiteral(query.isAvailable);
    if (isAvailable === null) {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'isAvailable must be exactly one of the literal strings true or false.',
      });
      return;
    }
    filter.isAvailable = isAvailable;
  }

  response.status(200).json(await listResources(filter));
}
