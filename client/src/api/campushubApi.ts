import axios from 'axios';

export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

export interface CreateReservationDTO {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

export interface Reservation extends CreateReservationDTO {
  id: string;
  status: ReservationStatus;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ResourceQuery {
  type?: string;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  headers: { Accept: 'application/json' },
});

function isErrorBody(value: unknown): value is { code: string; message: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as { code?: unknown; message?: unknown };
  return typeof body.code === 'string' && typeof body.message === 'string';
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data: unknown = error.response?.data;
    if (isErrorBody(data)) {
      return new ApiError(status, data.code, data.message);
    }
    return new ApiError(status, 'INTERNAL_ERROR', 'The request failed.');
  }
  return new ApiError(0, 'INTERNAL_ERROR', 'The request failed.');
}

async function readData<T>(request: Promise<{ data: T }>): Promise<T> {
  try {
    const response = await request;
    return response.data;
  } catch (error: unknown) {
    throw toApiError(error);
  }
}

const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isStudentId(value: string): boolean {
  return STUDENT_ID_PATTERN.test(value);
}

export function describeApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message !== '') {
    return error.message;
  }
  return fallback;
}

export function fetchResources(type?: string): Promise<Resource[]> {
  const params: ResourceQuery = {};
  if (type !== undefined && type !== '') {
    params.type = type;
  }
  return readData(api.get<Resource[]>('/resources', { params }));
}

export function createReservation(payload: CreateReservationDTO): Promise<Reservation> {
  return readData(api.post<Reservation>('/reservations', payload));
}

export function fetchUserReservations(userId: string): Promise<Reservation[]> {
  return readData(api.get<Reservation[]>(`/reservations/user/${encodeURIComponent(userId)}`));
}

export function cancelReservation(reservationId: string): Promise<Reservation> {
  return readData(
    api.patch<Reservation>(`/reservations/${encodeURIComponent(reservationId)}/cancel`),
  );
}
