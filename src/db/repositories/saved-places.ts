import {desc, eq} from 'drizzle-orm';

import {getDatabase} from '../client';
import {savedPlaces} from '../schema';
import {
  canAddSavedPlace,
  SavedPlaceLimitError,
} from '@/lib/saved-places';

export type SavedPlaceKind = 'home' | 'work' | 'favorite';

export type SavedPlaceRow = {
  id: number;
  kind: SavedPlaceKind;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: Date;
};

export const DEFAULT_SAVED_PLACE_RADIUS_METERS = 20;

function mapRow(row: typeof savedPlaces.$inferSelect): SavedPlaceRow {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radiusMeters,
    createdAt: row.createdAt,
  };
}

export async function listSavedPlaces(): Promise<SavedPlaceRow[]> {
  const db = await getDatabase();
  const rows = await db.select().from(savedPlaces);
  return rows.map(mapRow);
}

export async function upsertHomePlace(
  lat: number,
  lng: number,
  radiusMeters = DEFAULT_SAVED_PLACE_RADIUS_METERS,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const existing = await listSavedPlaces();
  if (!canAddSavedPlace(existing, 'home')) {
    throw new SavedPlaceLimitError();
  }
  await db.delete(savedPlaces).where(eq(savedPlaces.kind, 'home'));
  await db.insert(savedPlaces).values({
    kind: 'home',
    label: 'Home',
    lat,
    lng,
    radiusMeters,
    createdAt: new Date(),
  });
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.kind, 'home'))
    .limit(1);
  return mapRow(rows[0]!);
}

export async function upsertWorkPlace(
  lat: number,
  lng: number,
  radiusMeters = DEFAULT_SAVED_PLACE_RADIUS_METERS,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const existing = await listSavedPlaces();
  if (!canAddSavedPlace(existing, 'work')) {
    throw new SavedPlaceLimitError();
  }
  await db.delete(savedPlaces).where(eq(savedPlaces.kind, 'work'));
  await db.insert(savedPlaces).values({
    kind: 'work',
    label: 'Work',
    lat,
    lng,
    radiusMeters,
    createdAt: new Date(),
  });
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.kind, 'work'))
    .limit(1);
  return mapRow(rows[0]!);
}

export async function addFavoritePlace(
  lat: number,
  lng: number,
  label: string,
  radiusMeters = DEFAULT_SAVED_PLACE_RADIUS_METERS,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Favorite name is required');
  }
  const existing = await listSavedPlaces();
  if (!canAddSavedPlace(existing, 'favorite')) {
    throw new SavedPlaceLimitError();
  }
  await db.insert(savedPlaces).values({
    kind: 'favorite',
    label: trimmed,
    lat,
    lng,
    radiusMeters,
    createdAt: new Date(),
  });
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.kind, 'favorite'))
    .orderBy(desc(savedPlaces.id))
    .limit(1);
  return mapRow(rows[0]!);
}

export async function deleteSavedPlace(id: number): Promise<void> {
  const db = await getDatabase();
  await db.delete(savedPlaces).where(eq(savedPlaces.id, id));
}
