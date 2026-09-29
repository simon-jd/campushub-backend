import type { Resource, ResourceType } from '../types/reservation';

const resources: readonly Resource[] = [
  {
    id: 'res-101',
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: true,
  },
  {
    id: 'res-102',
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Makerspace',
    isAvailable: true,
  },
  {
    id: 'res-103',
    name: 'Computer Lab 201',
    type: 'LAB',
    location: 'Science Building, Floor 2',
    isAvailable: true,
  },
  {
    id: 'res-104',
    name: 'Study Room 304',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: false,
  },
];

export function listResources(type?: ResourceType): Resource[] {
  return resources
    .filter((resource: Resource): boolean => type === undefined || resource.type === type)
    .map((resource: Resource): Resource => ({ ...resource }));
}

export function getResource(id: string): Resource | undefined {
  const resource = resources.find((candidate: Resource): boolean => candidate.id === id);
  return resource === undefined ? undefined : { ...resource };
}
