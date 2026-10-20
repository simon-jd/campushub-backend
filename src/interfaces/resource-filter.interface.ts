import type { ResourceType } from '../types/reservation';

// Catalog filters from GET /api/v1/resources. An omitted field means "do not narrow on it";
// isAvailable: false is a real filter, so Services must test for undefined, not falsiness.
export interface ResourceFilter {
  type?: ResourceType;
  isAvailable?: boolean;
}
