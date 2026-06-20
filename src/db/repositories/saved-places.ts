import {desc, eq} from 'drizzle-orm';

import {getDatabase} from '../client';
import {savedPlaces} from '../schema';
import {lookupSavedPlaceAddress} from '@/lib/saved-place-address';
import {
  canAddSavedPlace,
  normalizeSavedPlaceLabel,
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
  addressLine: string | null;
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
    addressLine: row.addressLine ?? null,
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
  const addressLine = await lookupSavedPlaceAddress(lat, lng);
  await db.delete(savedPlaces).where(eq(savedPlaces.kind, 'home'));
  await db.insert(savedPlaces).values({
    kind: 'home',
    label: 'Home',
    lat,
    lng,
    radiusMeters,
    addressLine,
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
  const addressLine = await lookupSavedPlaceAddress(lat, lng);
  await db.delete(savedPlaces).where(eq(savedPlaces.kind, 'work'));
  await db.insert(savedPlaces).values({
    kind: 'work',
    label: 'Work',
    lat,
    lng,
    radiusMeters,
    addressLine,
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
  const trimmed = normalizeSavedPlaceLabel(label);
  const existing = await listSavedPlaces();
  if (!canAddSavedPlace(existing, 'favorite')) {
    throw new SavedPlaceLimitError();
  }
  const addressLine = await lookupSavedPlaceAddress(lat, lng);
  await db.insert(savedPlaces).values({
    kind: 'favorite',
    label: trimmed,
    lat,
    lng,
    radiusMeters,
    addressLine,
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

export async function updateSavedPlaceAddressLine(
  id: number,
  addressLine: string,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const trimmed = addressLine.trim();
  if (!trimmed) {
    throw new Error('Address is required');
  }
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.id, id))
    .limit(1);
  const existing = rows[0];
  if (existing == null) {
    throw new Error('Saved place not found');
  }
  await db
    .update(savedPlaces)
    .set({addressLine: trimmed})
    .where(eq(savedPlaces.id, id));
  return mapRow({...existing, addressLine: trimmed});
}

export async function updateFavoritePlaceLabel(
  id: number,
  label: string,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const trimmed = normalizeSavedPlaceLabel(label);
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.id, id))
    .limit(1);
  const existing = rows[0];
  if (existing == null) {
    throw new Error('Saved place not found');
  }
  if (existing.kind !== 'favorite') {
    throw new Error('Only favorite places can be renamed');
  }
  await db
    .update(savedPlaces)
    .set({label: trimmed})
    .where(eq(savedPlaces.id, id));
  return mapRow({...existing, label: trimmed});
}

export async function deleteSavedPlace(id: number): Promise<void> {
  const db = await getDatabase();
  await db.delete(savedPlaces).where(eq(savedPlaces.id, id));
}
