// Derived from docs/openapi.json. Keep this file free of runtime logic.
export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

export interface CreateReservationRequest {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

export interface Reservation extends CreateReservationRequest {
  id: string;
  status: ReservationStatus;
}

export interface ErrorResponse {
  code:
    | 'VALIDATION_ERROR'
    | 'RESOURCE_NOT_FOUND'
    | 'RESOURCE_UNAVAILABLE'
    | 'DOUBLE_BOOKING'
    | 'NOT_FOUND'
    | 'PAYLOAD_TOO_LARGE'
    | 'UNSUPPORTED_MEDIA_TYPE'
    | 'INTERNAL_ERROR';
  message: string;
}
