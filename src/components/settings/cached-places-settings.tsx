import {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Platform, Pressable, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Map as MapIcon} from 'lucide-react-native';

import {SettingsGroupDivider} from '@/components/settings/settings-group';
import {Text} from '@/components/ui/text';
import {
  countLegacyPlaceLookupCandidatesPending,
  migrateLegacyPlaceLookupCandidatesToPois,
} from '@/db/migrate-place-pois-data';
import {listPlaceLookupCacheRows} from '@/db/repositories/place-lookup-cache';
import {listPlacePois} from '@/db/repositories/place-pois';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  getPlaceLookupRevision,
  subscribePlaceLookup,
} from '@/lib/place-lookup-events';
import type {
  PlaceLookupRow,
  PlaceLookupStatus,
  PlacePoiRow,
} from '@/lib/place-lookup-types';
import {
  countCachesNeedingPoiCoordinateRefresh,
  refreshAllPlacePoiCoordinates,
  type PlacePoiCoordinateRefreshProgress,
} from '@/lib/place-poi-coordinate-refresh';
import {distanceMeters} from '@/lib/place-lookup-venue';
import type {RootStackParamList} from '@/navigation/types';
import {cn} from '@/lib/utils';

function sortCachedPlaces(rows: PlaceLookupRow[]): PlaceLookupRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.fetchedAt?.getTime() ?? 0;
    const bTime = b.fetchedAt?.getTime() ?? 0;
    if (bTime !== aTime) {
      return bTime - aTime;
    }
    return b.id - a.id;
  });
}

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function formatFetchedAt(date: Date | null): string | null {
  if (date == null) {
    return null;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(status: PlaceLookupStatus): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
  }
}

function statusTone(status: PlaceLookupStatus): string {
  switch (status) {
    case 'complete':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'pending':
      return 'text-amber-600 dark:text-amber-400';
    case 'failed':
      return 'text-destructive';
  }
}

function primaryAddress(row: PlaceLookupRow): string {
  const trimmed = row.addressLine?.trim();
  if (trimmed) {
    return trimmed;
  }

  switch (row.lookupStatus) {
    case 'pending':
      return 'Pending lookup';
    case 'failed':
      return 'Lookup failed';
    default:
      return 'No address';
  }
}

function formatDistanceMeters(distanceM: number): string {
  if (distanceM < 1) {
    return '<1 m';
  }
  if (distanceM < 1000) {
    return `${Math.round(distanceM)} m`;
  }
  return `${(distanceM / 1000).toFixed(1)} km`;
}

function poiDistanceLabel(
  anchor: {lat: number; lng: number},
  poi: PlacePoiRow,
): string {
  const sameLat = Math.abs(poi.lat - anchor.lat) < 1e-5;
  const sameLng = Math.abs(poi.lng - anchor.lng) < 1e-5;
  if (sameLat && sameLng) {
    return 'at address';
  }
  return formatDistanceMeters(distanceMeters(anchor, poi));
}

type CachedPlaceCardProps = {
  row: PlaceLookupRow;
  pois: PlacePoiRow[];
  showDivider: boolean;
  onOpenMap: (cacheId: number) => void;
};

function CachedPlaceCard({row, pois, showDivider, onOpenMap}: CachedPlaceCardProps) {
  const colors = useThemeColors();
  const fetchedLabel = formatFetchedAt(row.fetchedAt);
  const anchor = {lat: row.anchorLat, lng: row.anchorLng};

  return (
    <>
      {showDivider ? <SettingsGroupDivider /> : null}
      <View className="px-4 py-3">
        <View className="flex-row items-start gap-3">
          <Text className="flex-1 text-base font-medium leading-5">
            {primaryAddress(row)}
          </Text>
          <View className="items-end gap-1.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show map for ${primaryAddress(row)}`}
              onPress={() => onOpenMap(row.id)}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full bg-secondary active:opacity-70">
              <MapIcon size={16} color={colors.primary} strokeWidth={2.25} />
            </Pressable>
            <Text className={cn('text-xs font-medium', statusTone(row.lookupStatus))}>
              {statusLabel(row.lookupStatus)}
            </Text>
          </View>
        </View>

        <Text variant="muted" className="mt-1 text-sm leading-5">
          {formatCoordinate(row.anchorLat)}, {formatCoordinate(row.anchorLng)}
          {' · '}
          {row.venueRadiusMeters} m radius
        </Text>

        {fetchedLabel ? (
          <Text variant="muted" className="mt-1 text-xs">
            Fetched {fetchedLabel}
          </Text>
        ) : null}

        <View className="mt-3">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            POIs
          </Text>
          {pois.length > 0 ? (
            <View className="mt-1.5 gap-1.5">
              {pois.map(poi => (
                <View key={poi.id} className="flex-row items-start gap-2">
                  <Text variant="muted" className="text-sm leading-5">
                    •
                  </Text>
                  <Text className="flex-1 text-sm leading-5">
                    {poi.name}
                    <Text variant="muted" className="text-sm">
                      {' '}
                      · {formatCoordinate(poi.lat)}, {formatCoordinate(poi.lng)}
                    </Text>
                    {poi.source === 'user' ? (
                      <Text variant="muted" className="text-sm">
                        {' '}
                        · Custom
                      </Text>
                    ) : (
                      <Text variant="muted" className="text-sm">
                        {' '}
                        · {poiDistanceLabel(anchor, poi)}
                      </Text>
                    )}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="muted" className="mt-1 text-sm leading-5">
              No nearby POIs
            </Text>
          )}
        </View>
      </View>
    </>
  );
}

export function CachedPlacesSettings() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<PlaceLookupRow[]>([]);
  const [poisByCacheId, setPoisByCacheId] = useState<Map<number, PlacePoiRow[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [legacyPendingCount, setLegacyPendingCount] = useState(0);
  const [coordinateRefreshPendingCount, setCoordinateRefreshPendingCount] =
    useState(0);
  const [migrating, setMigrating] = useState(false);
  const [refreshingCoordinates, setRefreshingCoordinates] = useState(false);
  const [coordinateRefreshProgress, setCoordinateRefreshProgress] =
    useState<PlacePoiCoordinateRefreshProgress | null>(null);
  const [revision, setRevision] = useState(getPlaceLookupRevision);
  const canRefreshPoiCoordinates =
    Platform.OS === 'ios' && coordinateRefreshPendingCount > 0;

  useEffect(() => subscribePlaceLookup(() => setRevision(getPlaceLookupRevision())), []);

  const loadRows = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [next, allPois, pendingLegacy, pendingCoordinateRefresh] =
        await Promise.all([
        listPlaceLookupCacheRows(),
        listPlacePois(),
        countLegacyPlaceLookupCandidatesPending(),
        countCachesNeedingPoiCoordinateRefresh(),
      ]);
      const grouped = new Map<number, PlacePoiRow[]>();
      for (const poi of allPois) {
        const list = grouped.get(poi.cacheId) ?? [];
        list.push(poi);
        grouped.set(poi.cacheId, list);
      }
      setRows(sortCachedPlaces(next));
      setPoisByCacheId(grouped);
      setLegacyPendingCount(pendingLegacy);
      setCoordinateRefreshPendingCount(pendingCoordinateRefresh);
    } catch (error) {
      setRows([]);
      setPoisByCacheId(new Map());
      setLegacyPendingCount(0);
      setCoordinateRefreshPendingCount(0);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load cached places.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows, revision]);

  const runLegacyMigration = useCallback(async () => {
    setMigrating(true);
    try {
      const result = await migrateLegacyPlaceLookupCandidatesToPois();
      await loadRows();
      Alert.alert(
        'POIs migrated',
        result.insertedPois > 0
          ? `Moved ${result.insertedPois.toLocaleString()} nearby places into the new POI table for ${result.migratedCaches.toLocaleString()} cached addresses.`
          : 'No legacy POI data was left to migrate.',
      );
    } catch (error) {
      Alert.alert(
        'Migration failed',
        error instanceof Error ? error.message : 'Could not migrate cached POIs.',
      );
    } finally {
      setMigrating(false);
    }
  }, [loadRows]);

  const confirmLegacyMigration = useCallback(() => {
    Alert.alert(
      'Migrate cached POIs?',
      `This moves POI names from the old storage format into the new place_pois table for ${legacyPendingCount.toLocaleString()} cached address${legacyPendingCount === 1 ? '' : 'es'}. POIs without coordinates use the cache anchor as a fallback.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Migrate',
          onPress: () => {
            void runLegacyMigration();
          },
        },
      ],
    );
  }, [legacyPendingCount, runLegacyMigration]);

  const runCoordinateRefresh = useCallback(async () => {
    setRefreshingCoordinates(true);
    setCoordinateRefreshProgress({completed: 0, total: coordinateRefreshPendingCount, cacheId: 0, addressLine: null});
    try {
      const result = await refreshAllPlacePoiCoordinates({
        onProgress: setCoordinateRefreshProgress,
      });
      await loadRows();
      const summary = [
        `${result.refreshed.toLocaleString()} refreshed`,
        result.updatedPois > 0
          ? `${result.updatedPois.toLocaleString()} POI coordinates updated`
          : null,
        result.insertedPois > 0
          ? `${result.insertedPois.toLocaleString()} POIs added`
          : null,
        result.failed > 0 ? `${result.failed.toLocaleString()} failed` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      Alert.alert(
        'POI coordinates refreshed',
        summary.length > 0
          ? `${summary}.\n\nRebuild trips in Developer tools to apply updated POI positions to history.`
          : 'No cached addresses needed coordinate refresh.',
      );
    } catch (error) {
      Alert.alert(
        'Refresh failed',
        error instanceof Error ? error.message : 'Could not refresh POI coordinates.',
      );
    } finally {
      setRefreshingCoordinates(false);
      setCoordinateRefreshProgress(null);
    }
  }, [coordinateRefreshPendingCount, loadRows]);

  const confirmCoordinateRefresh = useCallback(() => {
    Alert.alert(
      'Refresh POI coordinates?',
      `This fetches MapKit POI locations for ${coordinateRefreshPendingCount.toLocaleString()} cached address${coordinateRefreshPendingCount === 1 ? '' : 'es'}. Existing POIs are updated in place — nothing is deleted. Custom POIs are kept.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Refresh',
          onPress: () => {
            void runCoordinateRefresh();
          },
        },
      ],
    );
  }, [coordinateRefreshPendingCount, runCoordinateRefresh]);

  const openCachedPlaceMap = useCallback(
    (cacheId: number) => {
      navigation.navigate('CachedPlaceMap', {cacheId});
    },
    [navigation],
  );

  const summary = useMemo(() => {
    if (loading) {
      return null;
    }
    const complete = rows.filter(row => row.lookupStatus === 'complete').length;
    return `${rows.length} total · ${complete} complete`;
  }, [loading, rows]);

  return (
    <View className="mt-4">
      {!loading && legacyPendingCount > 0 ? (
        <View className="bg-card border-border mb-4 rounded-xl border px-4 py-4">
          <Text className="text-base font-medium">Legacy POI data</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            {legacyPendingCount.toLocaleString()} cached address
            {legacyPendingCount === 1 ? '' : 'es'} still store POIs in the old
            format. Migrate once to enable per-visit POI selection.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Migrate cached POIs"
            disabled={migrating}
            onPress={confirmLegacyMigration}
            className="bg-primary mt-3 min-h-[44px] items-center justify-center rounded-xl px-4 py-3 active:opacity-80 disabled:opacity-50">
            {migrating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">
                Migrate POIs
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {!loading && canRefreshPoiCoordinates ? (
        <View className="bg-card border-border mb-4 rounded-xl border px-4 py-4">
          <Text className="text-base font-medium">Refresh POI coordinates</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            {coordinateRefreshPendingCount.toLocaleString()} cached address
            {coordinateRefreshPendingCount === 1 ? '' : 'es'} still use
            placeholder POI coordinates. Fetch real MapKit locations once, then
            rebuild trips in Developer tools.
          </Text>
          {coordinateRefreshProgress != null &&
          coordinateRefreshProgress.total > 0 ? (
            <Text variant="muted" className="mt-2 text-xs leading-4">
              {Math.min(
                coordinateRefreshProgress.completed + 1,
                coordinateRefreshProgress.total,
              ).toLocaleString()}{' '}
              / {coordinateRefreshProgress.total.toLocaleString()}
              {coordinateRefreshProgress.addressLine
                ? ` · ${coordinateRefreshProgress.addressLine}`
                : ''}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh POI coordinates"
            disabled={refreshingCoordinates || migrating}
            onPress={confirmCoordinateRefresh}
            className="bg-primary mt-3 min-h-[44px] items-center justify-center rounded-xl px-4 py-3 active:opacity-80 disabled:opacity-50">
            {refreshingCoordinates ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">
                Refresh POI coordinates
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {summary ? (
        <Text variant="muted" className="text-sm leading-5">
          {summary}
        </Text>
      ) : null}

      {errorMessage ? (
        <Text variant="muted" className="mt-3 text-sm leading-5">
          {errorMessage}
        </Text>
      ) : null}

      {loading ? (
        <Text variant="muted" className="mt-4 text-sm leading-5">
          Loading cached places…
        </Text>
      ) : rows.length === 0 ? (
        <Text variant="muted" className="mt-4 text-sm leading-5">
          No cached places yet. Reverse-geocode and nearby POI results will appear
          here after lookups run.
        </Text>
      ) : (
        <View className="border-border mt-4 overflow-hidden rounded-xl border">
          {rows.map((row, index) => (
            <CachedPlaceCard
              key={row.id}
              row={row}
              pois={poisByCacheId.get(row.id) ?? []}
              showDivider={index > 0}
              onOpenMap={openCachedPlaceMap}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export async function loadCachedPlacesCount(): Promise<number> {
  const rows = await listPlaceLookupCacheRows();
  return rows.length;
}
