import type {ParsedPoint} from '../types';

/** Points ordered by database id (what #1469 → #1470 means). */
export function sortPointsById(points: ParsedPoint[]): ParsedPoint[] {
  return [...points].sort((a, b) => a.id - b.id);
}

export function indexOfPointId(
  pointsById: ParsedPoint[],
  id: number | null,
): number {
  if (id == null) {
    return -1;
  }
  return pointsById.findIndex(point => point.id === id);
}

export function adjacentPointId(
  pointsById: ParsedPoint[],
  currentId: number | null,
  direction: -1 | 1,
): number | null {
  if (pointsById.length === 0) {
    return null;
  }
  if (currentId == null) {
    return direction === 1 ? pointsById[0]!.id : pointsById.at(-1)!.id;
  }

  const index = indexOfPointId(pointsById, currentId);
  if (index < 0) {
    return direction === 1 ? pointsById[0]!.id : pointsById.at(-1)!.id;
  }

  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= pointsById.length) {
    return null;
  }
  return pointsById[nextIndex]!.id;
}
