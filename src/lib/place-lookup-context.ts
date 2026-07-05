import {listPlaceLookupCacheRows} from '@/db/repositories/place-lookup-cache';
import {listPlacePois} from '@/db/repositories/place-pois';
import type {PlaceLookupRow, PlacePoiRow} from '@/lib/place-lookup-types';

export type PlaceLookupContext = {
  placeLookupCache: PlaceLookupRow[];
  placePois: PlacePoiRow[];
};

export async function loadPlaceLookupContext(): Promise<PlaceLookupContext> {
  const [placeLookupCache, placePois] = await Promise.all([
    listPlaceLookupCacheRows(),
    listPlacePois(),
  ]);
  return {placeLookupCache, placePois};
}
