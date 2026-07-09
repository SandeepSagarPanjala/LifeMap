import { and, desc, eq } from 'drizzle-orm';

import { getDatabase } from '../client';
import { savedPlaces } from '../schema';
import { DEFAULT_SAVED_PLACE_RADIUS_METERS } from '@/lib/app-constants';
import { lookupSavedPlaceAddress } from '@/lib/saved-place-address';
import { notifySavedPlacesUpdated } from '@/lib/saved-places-events';
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
  active: boolean;
  createdAt: Date;
};

function mapRow(row: typeof savedPlaces.$inferSelect): SavedPlaceRow {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radiusMeters,
    addressLine: row.addressLine ?? null,
    active: row.active !== 0,
    createdAt: row.createdAt,
  };
}

export async function listSavedPlaces(): Promise<SavedPlaceRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.active, 1));
  return rows.map(mapRow);
}

export async function getSavedPlaceById(
  id: number,
): Promise<SavedPlaceRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.id, id))
    .limit(1);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

async function deactivateSavedPlace(id: number): Promise<void> {
  const db = await getDatabase();
  await db.update(savedPlaces).set({ active: 0 }).where(eq(savedPlaces.id, id));
}

async function deactivateSavedPlacesByKind(
  kind: SavedPlaceKind,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(savedPlaces)
    .set({ active: 0 })
    .where(and(eq(savedPlaces.kind, kind), eq(savedPlaces.active, 1)));
}

export async function upsertHomePlace(
  lat: number,
  lng: number,
  _radiusMeters = DEFAULT_SAVED_PLACE_RADIUS_METERS,
  addressLineOverride?: string | null,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const existing = await listSavedPlaces();
  if (!canAddSavedPlace(existing, 'home')) {
    throw new SavedPlaceLimitError();
  }
  const override = addressLineOverride?.trim();
  const addressLine =
    override != null && override.length > 0
      ? override
      : await lookupSavedPlaceAddress(lat, lng);
  await deactivateSavedPlacesByKind('home');
  await db.insert(savedPlaces).values({
    kind: 'home',
    label: 'Home',
    lat,
    lng,
    radiusMeters: DEFAULT_SAVED_PLACE_RADIUS_METERS,
    addressLine,
    active: 1,
    createdAt: new Date(),
  });
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(and(eq(savedPlaces.kind, 'home'), eq(savedPlaces.active, 1)))
    .limit(1);
  notifySavedPlacesUpdated();
  return mapRow(rows[0]!);
}

export async function upsertWorkPlace(
  lat: number,
  lng: number,
  _radiusMeters = DEFAULT_SAVED_PLACE_RADIUS_METERS,
  addressLineOverride?: string | null,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const existing = await listSavedPlaces();
  if (!canAddSavedPlace(existing, 'work')) {
    throw new SavedPlaceLimitError();
  }
  const override = addressLineOverride?.trim();
  const addressLine =
    override != null && override.length > 0
      ? override
      : await lookupSavedPlaceAddress(lat, lng);
  await deactivateSavedPlacesByKind('work');
  await db.insert(savedPlaces).values({
    kind: 'work',
    label: 'Work',
    lat,
    lng,
    radiusMeters: DEFAULT_SAVED_PLACE_RADIUS_METERS,
    addressLine,
    active: 1,
    createdAt: new Date(),
  });
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(and(eq(savedPlaces.kind, 'work'), eq(savedPlaces.active, 1)))
    .limit(1);
  notifySavedPlacesUpdated();
  return mapRow(rows[0]!);
}

export async function addFavoritePlace(
  lat: number,
  lng: number,
  label: string,
  _radiusMeters = DEFAULT_SAVED_PLACE_RADIUS_METERS,
  addressLineOverride?: string | null,
): Promise<SavedPlaceRow> {
  const db = await getDatabase();
  const trimmed = normalizeSavedPlaceLabel(label);
  const existing = await listSavedPlaces();
  if (!canAddSavedPlace(existing, 'favorite')) {
    throw new SavedPlaceLimitError();
  }
  const override = addressLineOverride?.trim();
  const addressLine =
    override != null && override.length > 0
      ? override
      : await lookupSavedPlaceAddress(lat, lng);
  await db.insert(savedPlaces).values({
    kind: 'favorite',
    label: trimmed,
    lat,
    lng,
    radiusMeters: DEFAULT_SAVED_PLACE_RADIUS_METERS,
    addressLine,
    active: 1,
    createdAt: new Date(),
  });
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(and(eq(savedPlaces.kind, 'favorite'), eq(savedPlaces.active, 1)))
    .orderBy(desc(savedPlaces.id))
    .limit(1);
  notifySavedPlacesUpdated();
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
  if (existing == null || existing.active === 0) {
    throw new Error('Saved place not found');
  }
  await db
    .update(savedPlaces)
    .set({ addressLine: trimmed })
    .where(eq(savedPlaces.id, id));
  notifySavedPlacesUpdated();
  return mapRow({ ...existing, addressLine: trimmed });
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
  if (existing == null || existing.active === 0) {
    throw new Error('Saved place not found');
  }
  if (existing.kind !== 'favorite') {
    throw new Error('Only favorite places can be renamed');
  }
  await db
    .update(savedPlaces)
    .set({ label: trimmed })
    .where(eq(savedPlaces.id, id));
  notifySavedPlacesUpdated();
  return mapRow({ ...existing, label: trimmed });
}

export async function deleteSavedPlace(id: number): Promise<void> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.id, id))
    .limit(1);
  if (rows[0] == null || rows[0].active === 0) {
    return;
  }
  await deactivateSavedPlace(id);
  notifySavedPlacesUpdated();
}
