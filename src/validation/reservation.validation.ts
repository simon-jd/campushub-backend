import type {
  CreateReservationRequest,
  ReservationStatus,
  ResourceType,
} from '../types/reservation';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
}

export function isResourceType(value: unknown): value is ResourceType {
  return value === 'ROOM' || value === 'EQUIPMENT' || value === 'LAB';
}

export function isReservationStatus(value: unknown): value is ReservationStatus {
  return value === 'PENDING' || value === 'CONFIRMED' || value === 'CANCELLED';
}

// Query strings carry no types, so only the two literal spellings in the contract are accepted.
// Returns null for anything else; callers must compare against null, not rely on truthiness.
export function parseBooleanLiteral(value: unknown): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts =
    /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.exec(
      value,
    );
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (year < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (daysInMonth === undefined || day > daysInMonth) return false;
  // Date.parse alone silently rolls dates such as February 30 into the next month.
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999
  );
}

export function parseReservationInput(value: unknown): CreateReservationRequest | null {
  if (!isRecord(value)) return null;
  const fields = ['resourceId', 'userId', 'startTime', 'endTime'];
  if (
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((key: string): boolean => !fields.includes(key))
  )
    return null;
  const { resourceId, userId, startTime, endTime } = value;
  if (
    !isIdentifier(resourceId) ||
    !isIdentifier(userId) ||
    !isTimestamp(startTime) ||
    !isTimestamp(endTime)
  )
    return null;
  if (Date.parse(startTime) >= Date.parse(endTime)) return null;
  return { resourceId, userId, startTime, endTime };
}
