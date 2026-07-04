import {useCallback, useEffect, useMemo, useState} from 'react';
import {timezoneFieldLabel} from '@lifemap/copy';

import {PointsMap} from './components/PointsMap';
import {
  DEFAULT_EXPORT_NAME,
  DEFAULT_EXPORT_PATH,
  markDefaultExportLoadStarted,
} from './lib/default-export';
import {
  detectUploadDataKind,
  describeExportPayload,
  formatDateLabel,
  formatTimestamp,
  inferDefaultUploadMode,
  parseExport,
  parseMoments,
  parsePlaceLookupCache,
  parseSavedPlaces,
  uniqueDateKeys,
} from './lib/export';
import {
  buildTripResultForDay,
  collectAllStoredTripPoints,
  loadStoredTripExport,
  uniqueTripDateKeys,
  type StoredTripExport,
} from './lib/stored-trips';
import {
  DEFAULT_STOP_CONFIG,
  formatDuration,
  detectStops,
  type Stop,
  detectTrips,
  detectTripsForDay,
  MERGE_STAY_MAX_DISTANCE_M,
  MIN_DRIVE_DISTANCE_M,
  MISSING_MIN_DISTANCE_M,
  MISSING_MIN_GAP_MS,
  SAVED_PLACE_MIN_DWELL_MS,
  type TripSegment,
  displayPointsForSegment,
  plotPointsFromSegments,
  usesCanonicalSegmentGeometry,
  countBySource,
  filterPointsBySources,
  sourceLabel,
  TRIP_PLOT_SOURCES,
  uniqueSources,
} from '@lifemap/segmentation';
import {
  buildTripExportPayload,
  downloadTripExportJson,
  type TripExportGeometry,
} from './lib/trip-export';
import {describeTripSegment, drivePointCountLabel, formatMomentCountChips, stayPointCountLabel} from './lib/segment-display';
import {
  explainPoint,
  explainSegment,
  findSegmentForPoint,
} from './lib/explain';
import {
  adjacentPointId,
  indexOfPointId,
  sortPointsByTime,
} from './lib/point-nav';
import type {MomentRow, ParsedPoint, PlaceLookupRow, SavedPlaceRow, UploadMode} from './types';
import {MobileScreen} from './components/mobile/MobileScreen';

import './App.css';

type ExplorerMode = 'plot' | 'stops' | 'trips' | 'explain' | 'power' | 'mobile';
type PowerRunResult = {
  startedAt: Date;
  finishedAt: Date;
  elapsedMs: number;
  pointCount: number;
  segmentCount: number;
  inputStartAt: Date | null;
  inputEndAt: Date | null;
};

function TripDayExportActions({
  dateKey,
  segmentCount,
  showGeometryHint,
  onDownloadRaw,
  onDownloadCanonical,
}: {
  dateKey: string;
  segmentCount: number;
  showGeometryHint: boolean;
  onDownloadRaw: () => void;
  onDownloadCanonical: () => void;
}) {
  return (
    <div className="trip-export-actions" aria-label="Export day">
      <p className="source-filter-hint">
        Export {segmentCount.toLocaleString()} segment
        {segmentCount === 1 ? '' : 's'} for {formatDateLabel(dateKey)}.
      </p>
      <div className="trip-export-buttons">
        <button type="button" className="secondary-btn" onClick={onDownloadRaw}>
          Raw JSON
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={onDownloadCanonical}>
          Canonical JSON
        </button>
      </div>
      {showGeometryHint ? (
        <p className="source-filter-hint">
          Raw keeps every GPS fix per segment. Canonical uses the geometry toggles
          above.
        </p>
      ) : (
        <p className="source-filter-hint">
          Raw keeps every GPS fix per segment. Canonical simplifies stay and drive
          paths for plotting.
        </p>
      )}
    </div>
  );
}

function TripSegmentList({
  segments,
  selectedSegmentId,
  onSelectSegment,
  onShowFullTrip,
  onDownload,
  onDownloadCanonical,
  canonicalizeStayGeometry,
  canonicalizeDriveGeometry,
  moments,
}: {
  segments: TripSegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (segment: TripSegment) => void;
  onShowFullTrip: () => void;
  onDownload: () => void;
  onDownloadCanonical: () => void;
  canonicalizeStayGeometry: boolean;
  canonicalizeDriveGeometry: boolean;
  moments: readonly MomentRow[];
}) {
  return (
    <section className="trip-panel" aria-label="Trip segments">
      <div className="trip-panel-header">
        <span className="field-label">{segments.length} segments</span>
        <div className="source-filter-actions">
          {selectedSegmentId != null ? (
            <button type="button" className="link-btn" onClick={onShowFullTrip}>
              Show all
            </button>
          ) : null}
          <button type="button" className="link-btn" onClick={onDownload}>
            Export raw
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={onDownloadCanonical}>
            Export canonical
          </button>
        </div>
      </div>
      {segments.length === 0 ? (
        <p className="source-filter-hint">No stays or drives found.</p>
      ) : (
        <ol className="segment-list">
          {segments.map((segment, index) => {
            const isActive = segment.id === selectedSegmentId;
            const display = describeTripSegment(segment);
            const stats =
              segment.kind === 'stay'
                ? [
                    formatDuration(segment.durationMs),
                    stayPointCountLabel(
                      segment,
                      canonicalizeStayGeometry,
                      moments,
                    ),
                  ]
                : segment.kind === 'drive'
                  ? [
                      formatDuration(segment.durationMs),
                      display.stats[1] ?? '',
                      drivePointCountLabel(segment, canonicalizeDriveGeometry),
                    ]
                  : display.stats;
            const momentChips =
              display.momentCounts != null
                ? formatMomentCountChips(display.momentCounts)
                : [];
            return (
              <li key={segment.id}>
                <button
                  type="button"
                  className={
                    isActive ? 'segment-card is-active' : 'segment-card'
                  }
                  onClick={() => onSelectSegment(segment)}>
                  <div className="segment-card-top">
                    <span className="segment-index">{index + 1}</span>
                    <span
                      className={`segment-kind segment-kind-${display.variant}`}>
                      {display.kind}
                    </span>
                    {display.subtitle ? (
                      <span className="segment-subtitle">{display.subtitle}</span>
                    ) : null}
                    {display.placeLookupCacheId != null ? (
                      <span className="segment-meta">
                        cache #{display.placeLookupCacheId}
                      </span>
                    ) : null}
                  </div>
                  <div className="segment-time">{display.timeRange}</div>
                  {momentChips.length > 0 ? (
                    <div className="segment-moments">
                      {momentChips.map(chip => (
                        <span key={chip} className="segment-moment-chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="segment-stats">
                    {stats.map(stat => (
                      <span key={stat} className="segment-stat">
                        {stat}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function App() {
  const [allPoints, setAllPoints] = useState<ParsedPoint[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceRow[]>([]);
  const [placeLookupCache, setPlaceLookupCache] = useState<PlaceLookupRow[]>(
    [],
  );
  const [storedTripExport, setStoredTripExport] = useState<StoredTripExport | null>(
    null,
  );
  const [uploadMode, setUploadMode] = useState<UploadMode>('detect');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string>('all');
  const [mode, setMode] = useState<ExplorerMode>('plot');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pointNavMode, setPointNavMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [plottedPoints, setPlottedPoints] = useState<ParsedPoint[] | null>(null);
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TripSegment[] | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [tripPoints, setTripPoints] = useState<ParsedPoint[] | null>(null);
  const [tripStops, setTripStops] = useState<Stop[] | null>(null);
  const [powerResult, setPowerResult] = useState<PowerRunResult | null>(null);
  const [tripsCutoffAt, setTripsCutoffAt] = useState<Date | null>(null);
  const [tripsCutoffPointId, setTripsCutoffPointId] = useState<number | null>(
    null,
  );
  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [canonicalizeStayGeometry, setCanonicalizeStayGeometry] =
    useState(true);
  const [canonicalizeDriveGeometry, setCanonicalizeDriveGeometry] =
    useState(false);

  const dateKeys = useMemo(() => {
    if (storedTripExport != null) {
      return uniqueTripDateKeys(storedTripExport);
    }
    return uniqueDateKeys(allPoints);
  }, [allPoints, storedTripExport]);

  const isPlotUpload = storedTripExport != null;

  const filteredPoints = useMemo(() => {
    if (dateKey === 'all') {
      return allPoints;
    }
    return allPoints.filter(p => p.dateKey === dateKey);
  }, [allPoints, dateKey]);

  const availableSources = useMemo(
    () => uniqueSources(filteredPoints),
    [filteredPoints],
  );

  const sourceCounts = useMemo(
    () => countBySource(filteredPoints),
    [filteredPoints],
  );

  const plotCount = useMemo(() => {
    if (selectedSources.size === 0) {
      return 0;
    }
    return filterPointsBySources(filteredPoints, selectedSources).length;
  }, [filteredPoints, selectedSources]);

  const pointsById = useMemo(() => {
    const base = plottedPoints ?? [];
    if (selectedStopId != null && stops != null) {
      const stop = stops.find(s => s.id === selectedStopId);
      if (stop) {
        const idSet = new Set(stop.pointIds);
        return sortPointsByTime(base.filter(p => idSet.has(p.id)));
      }
    }
    return sortPointsByTime(base);
  }, [plottedPoints, selectedStopId, stops]);

  const selectedPoint = useMemo(() => {
    if (selectedId == null) {
      return null;
    }
    return (
      allPoints.find(point => point.id === selectedId) ??
      plottedPoints?.find(point => point.id === selectedId) ??
      null
    );
  }, [allPoints, plottedPoints, selectedId]);

  const selectedSegment = useMemo(
    () => segments?.find(segment => segment.id === selectedSegmentId) ?? null,
    [segments, selectedSegmentId],
  );

  const segmentExplanation = useMemo(() => {
    if (mode !== 'explain' || selectedSegment == null) {
      return null;
    }
    return explainSegment(selectedSegment, savedPlaces);
  }, [mode, selectedSegment, savedPlaces]);

  const pointExplanation = useMemo(() => {
    if (mode !== 'explain' || selectedPoint == null || segments == null) {
      return null;
    }
    return explainPoint(selectedPoint, segments, savedPlaces);
  }, [mode, selectedPoint, segments, savedPlaces]);

  const selectedIdIndex = useMemo(
    () => indexOfPointId(pointsById, selectedId),
    [pointsById, selectedId],
  );

  const enterPointNav = useCallback(() => {
    if (pointsById.length === 0) {
      return;
    }
    setPointNavMode(true);
    const inSequence =
      selectedId != null && pointsById.some(p => p.id === selectedId);
    if (!inSequence) {
      setSelectedId(pointsById[0]!.id);
    }
  }, [pointsById, selectedId]);

  const exitPointNav = useCallback(() => {
    setPointNavMode(false);
  }, []);

  const goPrevPoint = useCallback(() => {
    const prevId = adjacentPointId(pointsById, selectedId, -1);
    if (prevId != null) {
      setSelectedId(prevId);
    }
  }, [pointsById, selectedId]);

  const goNextPoint = useCallback(() => {
    const nextId = adjacentPointId(pointsById, selectedId, 1);
    if (nextId != null) {
      setSelectedId(nextId);
    }
  }, [pointsById, selectedId]);

  useEffect(() => {
    if (!pointNavMode) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevPoint();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNextPoint();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        exitPointNav();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exitPointNav, goNextPoint, goPrevPoint, pointNavMode]);

  const toggleSource = useCallback((source: string) => {
    setSelectedSources(previous => {
      const next = new Set(previous);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
    setPlottedPoints(null);
    setStops(null);
    setSelectedStopId(null);
    setSelectedId(null);
    setPointNavMode(false);
  }, []);

  const selectAllSources = useCallback(() => {
    setSelectedSources(new Set(availableSources));
    setPlottedPoints(null);
    setStops(null);
    setSelectedStopId(null);
    setSelectedId(null);
    setPointNavMode(false);
  }, [availableSources]);

  const clearAllSources = useCallback(() => {
    setSelectedSources(new Set());
    setPlottedPoints(null);
    setStops(null);
    setSelectedStopId(null);
    setSelectedId(null);
    setPointNavMode(false);
  }, []);

  const resetTripState = useCallback(() => {
    setSegments(null);
    setSelectedSegmentId(null);
    setTripPoints(null);
    setTripStops(null);
    setPowerResult(null);
    setTripsCutoffAt(null);
    setTripsCutoffPointId(null);
  }, []);

  const buildDayTrips = useCallback(() => {
    if (dateKey === 'all') {
      return null;
    }
    const tripSources = new Set<string>(TRIP_PLOT_SOURCES);
    setSelectedSources(tripSources);
    const tripSourcePoints = filterPointsBySources(allPoints, tripSources);
    return detectTripsForDay(
      dateKey,
      tripSourcePoints,
      undefined,
      savedPlaces,
      placeLookupCache,
      moments,
    );
  }, [dateKey, allPoints, moments, placeLookupCache, savedPlaces]);

  const applyTripResult = useCallback(
    (
      result: ReturnType<typeof detectTripsForDay>,
      options?: {keepSelectedId?: boolean},
    ) => {
      setTripPoints(result.points);
      setTripStops(result.stops);
      setSegments(result.segments);
      setSelectedSegmentId(null);
      setPlottedPoints(
        usesCanonicalSegmentGeometry(
          canonicalizeStayGeometry,
          canonicalizeDriveGeometry,
        )
          ? plotPointsFromSegments(
              result.segments,
              canonicalizeStayGeometry,
              moments,
              canonicalizeDriveGeometry,
            )
          : result.points,
      );
      setStops(result.stops);
      setSelectedStopId(null);
      if (!options?.keepSelectedId) {
        setSelectedId(null);
      }
      setPointNavMode(false);
      setPowerResult(null);
    },
    [canonicalizeDriveGeometry, canonicalizeStayGeometry, moments],
  );

  const loadExportText = useCallback(
    async (text: string, name: string) => {
      setError(null);
      try {
        const raw = JSON.parse(text);
        const kind = detectUploadDataKind(raw);
        const effectiveMode =
          kind === 'unknown' ? uploadMode : inferDefaultUploadMode(raw);

        if (effectiveMode === 'detect') {
          if (kind !== 'location_points') {
            throw new Error(
              `Detect mode needs location_points inside tables (or rows). Found: ${describeExportPayload(raw)}.`,
            );
          }
          setUploadMode('detect');
          const parsed = parseExport(raw);
          setAllPoints(parsed);
          setSavedPlaces(parseSavedPlaces(raw));
          setPlaceLookupCache(parsePlaceLookupCache(raw));
          setMoments(parseMoments(raw));
          setStoredTripExport(null);
          setFileName(name);
          setDateKey('all');
          setSelectedId(null);
          setPointNavMode(false);
          setSelectedSources(new Set(uniqueSources(parsed)));
          setPlottedPoints(null);
          setStops(null);
          setSelectedStopId(null);
          setSegments(null);
          setSelectedSegmentId(null);
          setTripPoints(null);
          setTripStops(null);
          setPowerResult(null);
          return;
        }

        if (kind !== 'stored_trips') {
          throw new Error(
            `Plot mode needs trips + trip_points inside tables. Found: ${describeExportPayload(raw)}.`,
          );
        }
        setUploadMode('plot');
        const stored = loadStoredTripExport(raw);
        const tripDates = uniqueTripDateKeys(stored);
        if (tripDates.length === 0) {
          throw new Error('Plot export has no trips.');
        }
        const latestDate = tripDates[tripDates.length - 1]!;
        const storedPoints = collectAllStoredTripPoints(stored);
        setStoredTripExport(stored);
        setAllPoints(storedPoints);
        setSavedPlaces(stored.savedPlaces);
        setPlaceLookupCache([]);
        setMoments([]);
        setFileName(name);
        setDateKey(latestDate);
        setMode('trips');
        setSelectedId(null);
        setPointNavMode(false);
        setSelectedSources(new Set(uniqueSources(storedPoints)));
        applyTripResult(buildTripResultForDay(stored, latestDate));
        setPowerResult(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse JSON');
        setAllPoints([]);
        setSavedPlaces([]);
        setPlaceLookupCache([]);
        setMoments([]);
        setStoredTripExport(null);
        setFileName(null);
        setPointNavMode(false);
        setSelectedSources(new Set());
        setPlottedPoints(null);
      }
    },
    [applyTripResult, uploadMode],
  );

  const loadFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      await loadExportText(text, file.name);
    },
    [loadExportText],
  );

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void loadFile(file);
      }
    },
    [loadFile],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file?.name.endsWith('.json')) {
        void loadFile(file);
      }
    },
    [loadFile],
  );

  useEffect(() => {
    if (!markDefaultExportLoadStarted()) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(DEFAULT_EXPORT_PATH);
        if (!response.ok || cancelled) {
          return;
        }
        const text = await response.text();
        if (cancelled) {
          return;
        }
        await loadExportText(text, DEFAULT_EXPORT_NAME);
      } catch {
        // Default export is optional (missing in prod or without __personal__).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadExportText]);

  const changeMode = useCallback(
    (next: ExplorerMode) => {
      setMode(next);
      if (
        (next === 'trips' || next === 'explain' || next === 'mobile') &&
        dateKey === 'all' &&
        dateKeys.length > 0
      ) {
        setDateKey(dateKeys[dateKeys.length - 1]!);
      }
      setPlottedPoints(null);
      setStops(null);
      setSelectedId(null);
      setSelectedStopId(null);
      setPointNavMode(false);
      if (
        storedTripExport != null &&
        (next === 'trips' || next === 'explain')
      ) {
        const key =
          dateKey === 'all' && dateKeys.length > 0
            ? dateKeys[dateKeys.length - 1]!
            : dateKey;
        if (key !== 'all') {
          applyTripResult(buildTripResultForDay(storedTripExport, key));
          return;
        }
      }
      resetTripState();
    },
    [resetTripState, dateKey, dateKeys, storedTripExport, applyTripResult],
  );

  const mobileDateKey =
    dateKey === 'all' && dateKeys.length > 0
      ? dateKeys[dateKeys.length - 1]!
      : dateKey;

  const handleDetectTrips = useCallback(() => {
    setTripsCutoffAt(null);
    setTripsCutoffPointId(null);
    if (storedTripExport != null && dateKey !== 'all') {
      applyTripResult(buildTripResultForDay(storedTripExport, dateKey));
      return;
    }
    const result = buildDayTrips();
    if (result != null) {
      applyTripResult(result);
    }
  }, [applyTripResult, buildDayTrips, dateKey, storedTripExport]);

  const handleDetectTripsUpToPoint = useCallback(() => {
    if (selectedPoint == null || dateKey === 'all' || isPlotUpload) {
      return;
    }
    const tripSources = new Set<string>(TRIP_PLOT_SOURCES);
    setSelectedSources(tripSources);
    const tripSourcePoints = filterPointsBySources(allPoints, tripSources);
    const cutoffMs = selectedPoint.at.getTime();
    const pointsUpTo = tripSourcePoints.filter(
      point => point.at.getTime() <= cutoffMs,
    );
    const result = detectTripsForDay(
      dateKey,
      pointsUpTo,
      undefined,
      savedPlaces,
      placeLookupCache,
      moments,
    );
    setTripsCutoffAt(selectedPoint.at);
    setTripsCutoffPointId(selectedPoint.id);
    setMode('trips');
    applyTripResult(result, {keepSelectedId: true});
  }, [
    allPoints,
    applyTripResult,
    dateKey,
    isPlotUpload,
    moments,
    placeLookupCache,
    savedPlaces,
    selectedPoint,
  ]);

  const handlePowerTest = useCallback(() => {
    const tripSources = new Set<string>(TRIP_PLOT_SOURCES);
    setSelectedSources(tripSources);
    const filtered = filterPointsBySources(filteredPoints, tripSources);
    const inputStartAt = filtered.length > 0 ? filtered[0]!.at : null;
    const inputEndAt =
      filtered.length > 0 ? filtered[filtered.length - 1]!.at : null;
    const startedAt = new Date();
    const startedPerf = performance.now();
    const result = detectTrips(
      filtered,
      undefined,
      savedPlaces,
      placeLookupCache,
      moments,
    );
    const finishedAt = new Date();
    const elapsedMs = performance.now() - startedPerf;
    setPowerResult({
      startedAt,
      finishedAt,
      elapsedMs,
      pointCount: filtered.length,
      segmentCount: result.segments.length,
      inputStartAt,
      inputEndAt,
    });
  }, [filteredPoints, moments, placeLookupCache, savedPlaces]);

  const handleDownloadTrips = useCallback(
    (geometry: TripExportGeometry) => {
      if (segments == null || segments.length === 0) {
        return;
      }
      const payload = buildTripExportPayload({
        source: fileName,
        dateFilter: dateKey,
        geometry,
        canonicalizeStayGeometry,
        canonicalizeDriveGeometry,
        segments,
        stops: tripStops ?? [],
        moments,
      });
      downloadTripExportJson(payload, dateKey);
    },
    [
      canonicalizeDriveGeometry,
      canonicalizeStayGeometry,
      dateKey,
      fileName,
      moments,
      segments,
      tripStops,
    ],
  );

  const showFullTrip = useCallback(() => {
    if (tripPoints == null || segments == null) {
      return;
    }
    setSelectedSegmentId(null);
    setPlottedPoints(
      usesCanonicalSegmentGeometry(
        canonicalizeStayGeometry,
        canonicalizeDriveGeometry,
      )
        ? plotPointsFromSegments(
            segments,
            canonicalizeStayGeometry,
            moments,
            canonicalizeDriveGeometry,
          )
        : tripPoints,
    );
    setStops(tripStops ?? []);
    setSelectedStopId(null);
    setSelectedId(null);
    setPointNavMode(false);
  }, [canonicalizeDriveGeometry, canonicalizeStayGeometry, moments, segments, tripPoints, tripStops]);

  const onSelectSegment = useCallback(
    (segment: TripSegment) => {
      setSelectedId(null);
      setPointNavMode(false);

      if (selectedSegmentId === segment.id) {
        setSelectedSegmentId(null);
        setPlottedPoints(
          tripPoints != null && segments != null
            ? usesCanonicalSegmentGeometry(
                canonicalizeStayGeometry,
                canonicalizeDriveGeometry,
              )
              ? plotPointsFromSegments(
                  segments,
                  canonicalizeStayGeometry,
                  moments,
                  canonicalizeDriveGeometry,
                )
              : tripPoints
            : tripPoints,
        );
        setStops(tripStops ?? []);
        setSelectedStopId(null);
        return;
      }

      setSelectedSegmentId(segment.id);
      if (segment.kind === 'missing') {
        return;
      }
      setPlottedPoints(
        displayPointsForSegment(
          segment,
          canonicalizeStayGeometry,
          moments,
          canonicalizeDriveGeometry,
        ),
      );
      if (segment.kind === 'stay') {
        setStops([segment.stop]);
        setSelectedStopId(segment.stop.id);
      } else {
        const context = [segment.fromStop, segment.toStop].filter(
          (s): s is Stop => s != null,
        );
        setStops(context);
        setSelectedStopId(null);
      }
    },
    [canonicalizeDriveGeometry, canonicalizeStayGeometry, moments, segments, selectedSegmentId, tripPoints, tripStops],
  );

  const handleSelectPoint = useCallback(
    (id: number) => {
      setSelectedId(id);
      if (mode !== 'explain' || segments == null) {
        return;
      }
      const segment = findSegmentForPoint(id, segments);
      if (segment == null || segment.kind === 'missing') {
        return;
      }
      setSelectedSegmentId(segment.id);
      setPlottedPoints(
        displayPointsForSegment(
          segment,
          canonicalizeStayGeometry,
          moments,
          canonicalizeDriveGeometry,
        ),
      );
      if (segment.kind === 'stay') {
        setStops([segment.stop]);
        setSelectedStopId(segment.stop.id);
      } else {
        const context = [segment.fromStop, segment.toStop].filter(
          (s): s is Stop => s != null,
        );
        setStops(context);
        setSelectedStopId(null);
      }
    },
    [canonicalizeDriveGeometry, canonicalizeStayGeometry, mode, moments, segments],
  );

  useEffect(() => {
    if (segments == null || tripPoints == null) {
      return;
    }
    if (selectedSegmentId != null) {
      const segment = segments.find(item => item.id === selectedSegmentId);
      if (segment != null && segment.kind !== 'missing') {
        setPlottedPoints(
          displayPointsForSegment(
            segment,
            canonicalizeStayGeometry,
            moments,
            canonicalizeDriveGeometry,
          ),
        );
      }
      return;
    }
    setPlottedPoints(
      usesCanonicalSegmentGeometry(
        canonicalizeStayGeometry,
        canonicalizeDriveGeometry,
      )
        ? plotPointsFromSegments(
            segments,
            canonicalizeStayGeometry,
            moments,
            canonicalizeDriveGeometry,
          )
        : tripPoints,
    );
  }, [
    canonicalizeDriveGeometry,
    canonicalizeStayGeometry,
    moments,
    segments,
    selectedSegmentId,
    tripPoints,
  ]);

  const handlePlot = useCallback(() => {
    const next = filterPointsBySources(filteredPoints, selectedSources);
    setPlottedPoints(next);
    setStops(null);
    setSelectedStopId(null);
    setSelectedId(null);
    setPointNavMode(false);
  }, [filteredPoints, selectedSources]);

  const handlePlotTrip = useCallback(() => {
    const tripSources = new Set<string>(TRIP_PLOT_SOURCES);
    setSelectedSources(tripSources);
    const next = filterPointsBySources(filteredPoints, tripSources);
    setPlottedPoints(next);
    setStops(null);
    setSelectedStopId(null);
    setSelectedId(null);
    setPointNavMode(false);
  }, [filteredPoints]);

  const handleDetectStops = useCallback(() => {
    const tripSources = new Set<string>(TRIP_PLOT_SOURCES);
    setSelectedSources(tripSources);
    const next = filterPointsBySources(filteredPoints, tripSources);
    setPlottedPoints(next);
    setStops(detectStops(next));
    setSelectedId(null);
    setPointNavMode(false);
  }, [filteredPoints]);

  const toggleStop = useCallback((stopId: string) => {
    setSelectedStopId(previous => (previous === stopId ? null : stopId));
  }, []);

  const visibleStops = useMemo(() => {
    if (stops == null) {
      return [];
    }
    if (selectedStopId == null) {
      return stops;
    }
    return stops.filter(stop => stop.id === selectedStopId);
  }, [stops, selectedStopId]);

  const highlightedPointIds = useMemo(() => {
    if (selectedStopId == null) {
      return null;
    }
    const stop = stops?.find(s => s.id === selectedStopId);
    return stop ? new Set(stop.pointIds) : null;
  }, [stops, selectedStopId]);

  useEffect(() => {
    if (storedTripExport != null) {
      return;
    }
    setSelectedSources(previous => {
      const next = new Set<string>();
      for (const source of availableSources) {
        if (previous.has(source)) {
          next.add(source);
        }
      }
      if (next.size === previous.size) {
        let unchanged = true;
        for (const source of next) {
          if (!previous.has(source)) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) {
          return previous;
        }
      }
      return next;
    });
    setPlottedPoints(null);
    setStops(null);
    setSelectedStopId(null);
    setSelectedId(null);
    setPointNavMode(false);
    setSegments(null);
    setSelectedSegmentId(null);
    setTripPoints(null);
    setTripStops(null);
  }, [availableSources, storedTripExport]);

  const canGoPrev = adjacentPointId(pointsById, selectedId, -1) != null;
  const canGoNext = adjacentPointId(pointsById, selectedId, 1) != null;
  const prevPointId = adjacentPointId(pointsById, selectedId, -1);
  const nextPointId = adjacentPointId(pointsById, selectedId, 1);

  return (
    <div className={mode === 'mobile' ? 'app is-mobile-mode' : 'app'}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>Location Point Explorer</h1>
          <p className="subtitle">Internal tool — not part of LifeMap app</p>
        </header>

        <div
          className="upload-mode"
          role="radiogroup"
          aria-label="Upload mode">
          <label className="upload-mode-option">
            <input
              type="radio"
              name="uploadMode"
              value="detect"
              checked={uploadMode === 'detect'}
              onChange={() => setUploadMode('detect')}
            />
            <span className="upload-mode-text">
              <strong>Detect</strong>
              <span className="upload-mode-hint">location_points → run algorithm</span>
            </span>
          </label>
          <label className="upload-mode-option">
            <input
              type="radio"
              name="uploadMode"
              value="plot"
              checked={uploadMode === 'plot'}
              onChange={() => setUploadMode('plot')}
            />
            <span className="upload-mode-text">
              <strong>Plot</strong>
              <span className="upload-mode-hint">trips + trip_points from mobile</span>
            </span>
          </label>
        </div>

        <label className="file-btn">
          Load JSON export
          <input
            type="file"
            accept=".json,application/json"
            onChange={onFileChange}
            hidden
          />
        </label>

        <p className="hint">
          Drop a JSON export anywhere on this page.{' '}
          {uploadMode === 'detect'
            ? 'Use location_points (GPS export or full database).'
            : 'Use trips + trip_points from mobile Settings export.'}
        </p>

        {error ? <p className="error">{error}</p> : null}

        {fileName ? (
          <>
            <details className="meta-details">
              <summary className="meta-summary">
                <span>Data summary</span>
                <span className="meta-summary-value">{fileName}</span>
              </summary>
              <section className="meta">
                <div>
                  <span className="label">File</span>
                  <span className="meta-value">{fileName}</span>
                </div>
                <div>
                  <span className="label">
                    {isPlotUpload ? 'Stored trips' : 'Total points'}
                  </span>
                  <span className="meta-value">
                    {isPlotUpload
                      ? storedTripExport!.trips.length.toLocaleString()
                      : allPoints.length.toLocaleString()}
                  </span>
                </div>
                {isPlotUpload ? (
                  <div>
                    <span className="label">Trip points</span>
                    <span className="meta-value">
                      {allPoints.length.toLocaleString()}
                    </span>
                  </div>
                ) : null}
                <div>
                  <span className="label">Date filter</span>
                  <span className="meta-value">
                    {filteredPoints.length.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="label">Plotted</span>
                  <span className="meta-value">
                    {plottedPoints != null
                      ? plottedPoints.length.toLocaleString()
                      : '—'}
                  </span>
                </div>
              </section>
            </details>

            <label className="field">
              <span className="field-label">
                {mode === 'trips'
                  ? timezoneFieldLabel('Trip date')
                  : mode === 'explain'
                    ? timezoneFieldLabel('Explain date')
                  : mode === 'power'
                    ? timezoneFieldLabel('Power test range')
                    : mode === 'mobile'
                      ? timezoneFieldLabel('Day')
                      : timezoneFieldLabel('Date')}
              </span>
              <select
                value={dateKey === 'all' && (mode === 'trips' || mode === 'explain' || mode === 'mobile') ? '' : dateKey}
                onChange={event => {
                  const nextDate = event.target.value;
                  setDateKey(nextDate);
                  if (storedTripExport != null && nextDate !== 'all') {
                    applyTripResult(
                      buildTripResultForDay(storedTripExport, nextDate),
                    );
                    return;
                  }
                  setPlottedPoints(null);
                  setStops(null);
                  setSelectedStopId(null);
                  setSelectedId(null);
                  setPointNavMode(false);
                  setSegments(null);
                  setSelectedSegmentId(null);
                  setTripPoints(null);
                  setTripStops(null);
                }}>
                {mode !== 'trips' && mode !== 'explain' && mode !== 'mobile' ? (
                  <option value="all">All dates ({dateKeys.length})</option>
                ) : null}
                {dateKeys.map(key => (
                  <option key={key} value={key}>
                    {formatDateLabel(key)} (
                    {allPoints.filter(p => p.dateKey === key).length})
                  </option>
                ))}
              </select>
              {mode === 'trips' || mode === 'explain' ? (
                <p className="source-filter-hint">
                  {mode === 'trips'
                    ? 'Trips are built for the selected day only.'
                    : 'Build trips, then click a segment or map point for why.'}
                </p>
              ) : mode === 'mobile' ? (
                <p className="mobile-mode-hint">
                  Mobile preview runs the same trip algorithm on imported GPS,
                  saved places, place cache, and moments — read-only, no saving.
                </p>
              ) : null}
            </label>

            <div className="mode-tabs" role="tablist" aria-label="Explorer mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'plot'}
                className={mode === 'plot' ? 'mode-tab is-active' : 'mode-tab'}
                onClick={() => changeMode('plot')}>
                Plot
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'stops'}
                className={mode === 'stops' ? 'mode-tab is-active' : 'mode-tab'}
                onClick={() => changeMode('stops')}>
                Stops
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'trips'}
                className={mode === 'trips' ? 'mode-tab is-active' : 'mode-tab'}
                onClick={() => changeMode('trips')}>
                Trips
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'explain'}
                className={mode === 'explain' ? 'mode-tab is-active' : 'mode-tab'}
                onClick={() => changeMode('explain')}>
                Explain
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'power'}
                className={mode === 'power' ? 'mode-tab is-active' : 'mode-tab'}
                onClick={() => changeMode('power')}>
                Power
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'mobile'}
                className={mode === 'mobile' ? 'mode-tab is-active' : 'mode-tab'}
                onClick={() => changeMode('mobile')}>
                Mobile
              </button>
            </div>

            {mode === 'plot' ? (
              <section className="source-filter" aria-label="Source types to plot">
                <div className="source-filter-header">
                  <span className="field-label">Source types</span>
                  <div className="source-filter-actions">
                    <button type="button" className="link-btn" onClick={selectAllSources}>
                      All
                    </button>
                    <button type="button" className="link-btn" onClick={clearAllSources}>
                      None
                    </button>
                  </div>
                </div>
                <div className="source-checkboxes">
                  {availableSources.map(source => {
                    const checked = selectedSources.has(source);
                    const count = sourceCounts.get(source) ?? 0;
                    return (
                      <label key={source} className="source-checkbox">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSource(source)}
                        />
                        <span className="source-checkbox-text">
                          <span className="source-checkbox-name">
                            {sourceLabel(source)}
                          </span>
                          <span className="source-checkbox-count">
                            {count.toLocaleString()}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="plot-btn"
                  disabled={selectedSources.size === 0 || plotCount === 0}
                  onClick={handlePlot}>
                  Plot {plotCount.toLocaleString()} point{plotCount === 1 ? '' : 's'}
                </button>
                <button
                  type="button"
                  className="trip-btn"
                  onClick={handlePlotTrip}>
                  Plot trip points (merged track)
                </button>
                <p className="source-filter-hint">
                  Choose one or more sources, then click Plot. Merged track = gps
                  + native_queue + motion_departure + native_queue:motionchange.
                </p>
              </section>
            ) : mode === 'stops' ? (
              <section className="stops-mode" aria-label="Identify stops">
                <button
                  type="button"
                  className="stops-btn"
                  onClick={handleDetectStops}>
                  Identify stops (circle them)
                </button>
                <p className="source-filter-hint">
                  Uses the merged trip track. A stop = stayed ≥ 5 min within 75 m
                  (driving points excluded by speed).
                </p>

                {stops != null ? (
                  <section className="stops-panel" aria-label="Detected stops">
                    <div className="stops-panel-header">
                      <span className="field-label">Stops ({stops.length})</span>
                      {selectedStopId != null ? (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setSelectedStopId(null)}>
                          Show all
                        </button>
                      ) : null}
                    </div>
                    {stops.length === 0 ? (
                      <p className="source-filter-hint">
                        No stops ≥ 5 min found for this selection.
                      </p>
                    ) : (
                      <ol className="stops-list">
                        {stops.map((stop, index) => {
                          const isActive = stop.id === selectedStopId;
                          return (
                            <li key={stop.id}>
                              <button
                                type="button"
                                className={
                                  isActive
                                    ? 'stops-list-item is-active'
                                    : 'stops-list-item'
                                }
                                onClick={() => toggleStop(stop.id)}>
                                <span className="stops-list-index">
                                  {index + 1}
                                </span>
                                <span className="stops-list-text">
                                  <span className="stops-list-time">
                                    {formatTimestamp(stop.arrivedAt.toISOString())
                                      .replace(/, \d{4}/, '')}
                                  </span>
                                  <span className="stops-list-meta">
                                    {formatDuration(stop.durationMs)} ·{' '}
                                    {stop.pointCount} pts · spread{' '}
                                    {Math.round(stop.spreadM)} m
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                ) : null}
              </section>
            ) : mode === 'trips' ? (
              <section className="stops-mode" aria-label="Trips">
                {!isPlotUpload ? (
                  <button
                    type="button"
                    className="stops-btn"
                    disabled={dateKey === 'all'}
                    onClick={handleDetectTrips}>
                    Identify trips (stays + drives)
                  </button>
                ) : (
                  <p className="source-filter-hint">
                    Plotted from mobile trips export. Change date to view another
                    day.
                  </p>
                )}
                <p className="source-filter-hint">
                  {dateKey === 'all'
                    ? 'Pick a date above, then identify trips.'
                    : isPlotUpload
                      ? `${segments?.length ?? 0} segments · ${formatDateLabel(dateKey)}`
                      : tripsCutoffAt != null
                        ? `${segments?.length ?? 0} segments · GPS through ${formatTimestamp(tripsCutoffAt.toISOString()).replace(/, \d{4}/, '')}${tripsCutoffPointId != null ? ` · point #${tripsCutoffPointId}` : ''}`
                        : `${filteredPoints.length.toLocaleString()} points · ${formatDateLabel(dateKey)}`}
                </p>
                {!isPlotUpload ? (
                  <div className="canonicalize-toggles">
                    <label className="canonicalize-toggle">
                      <input
                        type="checkbox"
                        checked={canonicalizeStayGeometry}
                        onChange={event =>
                          setCanonicalizeStayGeometry(event.target.checked)
                        }
                      />
                      <span className="canonicalize-toggle-text">
                        <strong>Canonical stay geometry</strong>
                        <span className="upload-mode-hint">
                          Plot stays as centroid + arrival + departure + moments
                          (venue wanders keep a simplified path)
                        </span>
                      </span>
                    </label>
                    <label className="canonicalize-toggle">
                      <input
                        type="checkbox"
                        checked={canonicalizeDriveGeometry}
                        onChange={event =>
                          setCanonicalizeDriveGeometry(event.target.checked)
                        }
                      />
                      <span className="canonicalize-toggle-text">
                        <strong>Canonical drive geometry</strong>
                        <span className="upload-mode-hint">
                          Turn-anchored Douglas–Peucker on drives (ε 15 m, keeps
                          turns ≥ 25°)
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}
                {segments != null && dateKey !== 'all' ? (
                  <TripDayExportActions
                    dateKey={dateKey}
                    segmentCount={segments.length}
                    showGeometryHint={!isPlotUpload}
                    onDownloadRaw={() => handleDownloadTrips('raw')}
                    onDownloadCanonical={() => handleDownloadTrips('canonical')}
                  />
                ) : null}
                <details className="meta-details">
                  <summary className="meta-summary">
                    <span>Trips algorithm info</span>
                    <span className="meta-summary-value">Visit + drive rules</span>
                  </summary>
                  <section className="meta">
                    <div>
                      <span className="label">Visit (stay) rule</span>
                      <span className="meta-value">
                        Stationary within {DEFAULT_STOP_CONFIG.radiusM} m for at
                        least {Math.round(DEFAULT_STOP_CONFIG.minDwellMs / 60000)} min.
                        Sparse gaps up to{' '}
                        {Math.round(DEFAULT_STOP_CONFIG.sparseBridgeMaxDistanceM)} m
                        can bridge when fixes are ≥{' '}
                        {Math.round(DEFAULT_STOP_CONFIG.sparseBridgeMinGapMs / 60000)}{' '}
                        min apart.
                      </span>
                    </div>
                    <div>
                      <span className="label">Moving speed gate</span>
                      <span className="meta-value">
                        Point is moving when speed ≥{' '}
                        {DEFAULT_STOP_CONFIG.movingSpeedMps} m/s.
                      </span>
                    </div>
                    <div>
                      <span className="label">Sparse GPS inferred visit</span>
                      <span className="meta-value">
                        High time gap + low distance: gap ≥{' '}
                        {Math.round(DEFAULT_STOP_CONFIG.minDwellMs / 60000)} min and
                        displacement ≤ {DEFAULT_STOP_CONFIG.radiusM} m.
                      </span>
                    </div>
                    <div>
                      <span className="label">Saved place special visit</span>
                      <span className="meta-value">
                        Inside the same saved place for at least{' '}
                        {Math.round(SAVED_PLACE_MIN_DWELL_MS / 60000)} min counts as
                        a stay.
                      </span>
                    </div>
                    <div>
                      <span className="label">Real drive rule</span>
                      <span className="meta-value">
                        Moving points with path ≥ {MIN_DRIVE_DISTANCE_M} m always
                        count (loop-back drives). Otherwise displacement must be ≥
                        {DEFAULT_STOP_CONFIG.radiusM} m, then either moving points
                        exist or path ≥ {MIN_DRIVE_DISTANCE_M} m.
                      </span>
                    </div>
                    <div>
                      <span className="label">Adjacent stay merge rule</span>
                      <span className="meta-value">
                        Consecutive stays are merged when centers are within{' '}
                        {MERGE_STAY_MAX_DISTANCE_M} m (same place).
                      </span>
                    </div>
                    <div>
                      <span className="label">Missing segment rule</span>
                      <span className="meta-value">
                        Inserted only when gap distance ≥ {MISSING_MIN_DISTANCE_M} m
                        and gap time ≥ {Math.round(MISSING_MIN_GAP_MS / 60000)} min.
                      </span>
                    </div>
                    <div>
                      <span className="label">Day boundary rule</span>
                      <span className="meta-value">
                        Home stays split at midnight. Drives and non-home stays
                        crossing midnight appear in full on both days (last on
                        previous day, first on next day).
                      </span>
                    </div>
                    <div>
                      <span className="label">Accuracy filter</span>
                      <span className="meta-value">
                        Points with accuracy worse than{' '}
                        {DEFAULT_STOP_CONFIG.maxAccuracyM} m are ignored.
                      </span>
                    </div>
                  </section>
                </details>

                {segments != null ? (
                  <TripSegmentList
                    segments={segments}
                    selectedSegmentId={selectedSegmentId}
                    onSelectSegment={onSelectSegment}
                    onShowFullTrip={showFullTrip}
                    onDownload={() => handleDownloadTrips('raw')}
                    onDownloadCanonical={() => handleDownloadTrips('canonical')}
                    canonicalizeStayGeometry={canonicalizeStayGeometry}
                    canonicalizeDriveGeometry={canonicalizeDriveGeometry}
                    moments={moments}
                  />
                ) : null}
              </section>
            ) : mode === 'explain' ? (
              <section className="stops-mode" aria-label="Explain trips">
                <button
                  type="button"
                  className="stops-btn"
                  disabled={dateKey === 'all'}
                  onClick={handleDetectTrips}>
                  Build trips &amp; explanations
                </button>
                <p className="source-filter-hint">
                  {dateKey === 'all'
                    ? 'Pick a date, then build explanations.'
                    : 'Click a segment or any map point to see why.'}
                </p>
                <div className="canonicalize-toggles">
                  <label className="canonicalize-toggle">
                    <input
                      type="checkbox"
                      checked={canonicalizeStayGeometry}
                      onChange={event =>
                        setCanonicalizeStayGeometry(event.target.checked)
                      }
                    />
                    <span className="canonicalize-toggle-text">
                      <strong>Canonical stay geometry</strong>
                      <span className="upload-mode-hint">
                        Map uses reduced stay points; explain still uses full
                        detection set
                      </span>
                    </span>
                  </label>
                  <label className="canonicalize-toggle">
                    <input
                      type="checkbox"
                      checked={canonicalizeDriveGeometry}
                      onChange={event =>
                        setCanonicalizeDriveGeometry(event.target.checked)
                      }
                    />
                    <span className="canonicalize-toggle-text">
                      <strong>Canonical drive geometry</strong>
                      <span className="upload-mode-hint">
                        Map uses simplified drive paths; explain still uses full
                        detection set
                      </span>
                    </span>
                  </label>
                </div>

                {segments != null ? (
                  <>
                    <TripSegmentList
                      segments={segments}
                      selectedSegmentId={selectedSegmentId}
                      onSelectSegment={onSelectSegment}
                      onShowFullTrip={showFullTrip}
                      onDownload={() => handleDownloadTrips('raw')}
                    onDownloadCanonical={() => handleDownloadTrips('canonical')}
                      canonicalizeStayGeometry={canonicalizeStayGeometry}
                      canonicalizeDriveGeometry={canonicalizeDriveGeometry}
                      moments={moments}
                    />
                    {segmentExplanation != null ? (
                      <section className="explain-panel" aria-label="Segment explanation">
                        <h3 className="explain-title">{segmentExplanation.title}</h3>
                        <p className="explain-kind">
                          Classified as{' '}
                          <strong>{segmentExplanation.kind.toUpperCase()}</strong>
                        </p>
                        <ul className="explain-list">
                          {segmentExplanation.reasons.map(reason => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                        {segmentExplanation.notes.length > 0 ? (
                          <ul className="explain-notes">
                            {segmentExplanation.notes.map(note => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        ) : null}
                      </section>
                    ) : (
                      <p className="source-filter-hint">
                        Select a segment above to see why it is a stay or drive.
                      </p>
                    )}
                  </>
                ) : null}
              </section>
            ) : mode === 'mobile' ? (
              <section className="stops-mode" aria-label="Mobile preview">
                <p className="source-filter-hint">
                  The map is on the right. Tap the circular{' '}
                  <strong>History</strong> button (bottom-left, clock icon) to
                  open the timeline — same as the LifeMap app.
                </p>
                <p className="source-filter-hint">
                  {mobileDateKey === 'all'
                    ? 'Pick a day above to build the timeline.'
                    : `${formatDateLabel(mobileDateKey)} · timeline builds automatically from imported GPS.`}
                </p>
              </section>
            ) : (
              <section className="power-mode" aria-label="Power benchmark">
                <button
                  type="button"
                  className="stops-btn"
                  onClick={handlePowerTest}>
                  Run trip detection benchmark
                </button>
                <p className="source-filter-hint">
                  Measures only algorithm time for detectTrips on merged trip
                  sources.
                </p>
                {powerResult ? (
                  <section className="power-panel" aria-label="Benchmark result">
                    <div>
                      <span className="label">Run start</span>
                      <span className="meta-value">
                        {formatTimestamp(powerResult.startedAt.toISOString())}
                      </span>
                    </div>
                    <div>
                      <span className="label">Run end</span>
                      <span className="meta-value">
                        {formatTimestamp(powerResult.finishedAt.toISOString())}
                      </span>
                    </div>
                    <div>
                      <span className="label">Elapsed</span>
                      <span className="meta-value">
                        {powerResult.elapsedMs.toFixed(2)} ms
                      </span>
                    </div>
                    <div>
                      <span className="label">Input points</span>
                      <span className="meta-value">
                        {powerResult.pointCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="label">Input range</span>
                      <span className="meta-value">
                        {powerResult.inputStartAt && powerResult.inputEndAt
                          ? `${formatTimestamp(powerResult.inputStartAt.toISOString())} → ${formatTimestamp(powerResult.inputEndAt.toISOString())}`
                          : 'No input points'}
                      </span>
                    </div>
                    <div>
                      <span className="label">Output segments</span>
                      <span className="meta-value">
                        {powerResult.segmentCount.toLocaleString()}
                      </span>
                    </div>
                  </section>
                ) : null}
              </section>
            )}

            {pointNavMode ? (
              <section className="point-nav" aria-label="Point-to-point navigation">
                <div className="point-nav-header">
                  <span className="point-nav-badge">Point-to-point</span>
                  <button
                    type="button"
                    className="point-nav-exit"
                    onClick={exitPointNav}>
                    Exit
                  </button>
                </div>
                <div className="point-nav-controls">
                  <button
                    type="button"
                    className="point-nav-arrow"
                    aria-label={
                      prevPointId != null
                        ? `Previous point #${prevPointId}`
                        : 'Previous point'
                    }
                    disabled={!canGoPrev}
                    onClick={goPrevPoint}>
                    ←
                  </button>
                  <span className="point-nav-position">
                    {selectedId != null ? `#${selectedId}` : '—'}
                  </span>
                  <button
                    type="button"
                    className="point-nav-arrow"
                    aria-label={
                      nextPointId != null
                        ? `Next point #${nextPointId}`
                        : 'Next point'
                    }
                    disabled={!canGoNext}
                    onClick={goNextPoint}>
                    →
                  </button>
                </div>
                {selectedIdIndex >= 0 ? (
                  <p className="point-nav-sub">
                    {selectedIdIndex + 1} of {pointsById.length.toLocaleString()}{' '}
                    {selectedStopId != null ? 'in this stop' : 'on this date'} ·
                    by time
                  </p>
                ) : null}
                {prevPointId != null || nextPointId != null ? (
                  <p className="point-nav-sub">
                    {prevPointId != null ? `← #${prevPointId}` : ''}
                    {prevPointId != null && nextPointId != null ? ' · ' : ''}
                    {nextPointId != null ? `→ #${nextPointId}` : ''}
                  </p>
                ) : null}
                <p className="point-nav-hint">
                  ← → arrow keys · Esc to exit
                </p>
              </section>
            ) : plottedPoints != null && plottedPoints.length > 0 ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={enterPointNav}>
                Point-to-point navigation
              </button>
            ) : null}

            {selectedPoint ? (
              <section
                className={
                  mode === 'explain' ? 'detail explain-detail' : 'detail'
                }>
                <h2>Point #{selectedPoint.id}</h2>
                {mode === 'explain' && pointExplanation != null ? (
                  <>
                    <p className="explain-kind">
                      {pointExplanation.assignment === 'unassigned'
                        ? 'Not in any segment'
                        : `${pointExplanation.assignment.toUpperCase()} · segment #${pointExplanation.segmentOrder}${pointExplanation.segmentLabel ? ` · ${pointExplanation.segmentLabel}` : ''}`}
                    </p>
                    <ul className="explain-list">
                      {pointExplanation.reasons.map(reason => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    {pointExplanation.hints.length > 0 ? (
                      <ul className="explain-notes">
                        {pointExplanation.hints.map(hint => (
                          <li key={hint}>{hint}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
                <dl>
                  <dt>Time</dt>
                  <dd>{formatTimestamp(selectedPoint.timestamp)}</dd>
                  <dt>Coordinates</dt>
                  <dd>
                    {selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}
                  </dd>
                  <dt>Accuracy</dt>
                  <dd>
                    {selectedPoint.accuracy != null
                      ? `${selectedPoint.accuracy.toFixed(1)} m`
                      : '—'}
                  </dd>
                  <dt>Source</dt>
                  <dd>{selectedPoint.source || '—'}</dd>
                </dl>
                {!isPlotUpload && dateKey !== 'all' ? (
                  <button
                    type="button"
                    className="stops-btn detail-trips-btn"
                    onClick={handleDetectTripsUpToPoint}>
                    Trips up to this point
                  </button>
                ) : null}
              </section>
            ) : (
              <p className="muted">
                {mode === 'mobile'
                  ? 'Map and history panel are in the main area →'
                  : pointNavMode
                    ? 'Select a point on the map or use the arrows.'
                    : mode === 'explain'
                      ? 'Click a map point to see why it belongs to a stay or drive.'
                      : 'Click a point on the map for details.'}
              </p>
            )}
          </>
        ) : (
          <p className="empty">
            Load an export — Detect for GPS points, Plot for stored trips.
          </p>
        )}
      </aside>

      <main
        className="map-panel"
        onDragOver={event => event.preventDefault()}
        onDrop={onDrop}>
        {allPoints.length > 0 ? (
          mode === 'mobile' ? (
            mobileDateKey !== 'all' ? (
              <MobileScreen
                dateKey={mobileDateKey}
                dateKeys={dateKeys}
                allPoints={allPoints}
                savedPlaces={savedPlaces}
                placeLookupCache={placeLookupCache}
                moments={moments}
                onDateChange={setDateKey}
              />
            ) : (
              <div className="map-placeholder">
                <p>Mobile preview</p>
                <p className="muted">Pick a day in the sidebar date dropdown.</p>
              </div>
            )
          ) : plottedPoints != null ? (
            <>
              {pointNavMode ? (
                <div className="map-nav-overlay">
                  <button
                    type="button"
                    className="map-nav-exit"
                    onClick={exitPointNav}>
                    Exit point-to-point
                  </button>
                </div>
              ) : null}
              <PointsMap
                points={plottedPoints}
                stops={visibleStops}
                selectedStopId={selectedStopId}
                onSelectStop={toggleStop}
                highlightedPointIds={highlightedPointIds}
                selectedId={selectedId}
                onSelectId={mode === 'explain' ? handleSelectPoint : setSelectedId}
                focusSelected={pointNavMode}
              />
            </>
          ) : (
            <div className="map-placeholder">
              {mode === 'plot' ? (
                <>
                  <p>Ready to plot</p>
                  <p className="muted">
                    Select source types in the sidebar and click{' '}
                    <strong>Plot</strong>
                  </p>
                </>
              ) : mode === 'stops' ? (
                <>
                  <p>Ready to find stops</p>
                  <p className="muted">
                    Click <strong>Identify stops</strong> in the sidebar
                  </p>
                </>
              ) : mode === 'trips' ? (
                <>
                  <p>Ready to build trips</p>
                  <p className="muted">
                    {dateKey === 'all'
                      ? 'Select a date in the sidebar, then click Identify trips'
                      : (
                          <>
                            Click <strong>Identify trips</strong> for{' '}
                            {formatDateLabel(dateKey)}
                          </>
                        )}
                  </p>
                </>
              ) : mode === 'explain' ? (
                <>
                  <p>Ready to explain trips</p>
                  <p className="muted">
                    Click <strong>Build trips &amp; explanations</strong> in the
                    sidebar
                  </p>
                </>
              ) : (
                <>
                  <p>Ready to benchmark</p>
                  <p className="muted">
                    Click <strong>Run trip detection benchmark</strong> in the
                    sidebar
                  </p>
                </>
              )}
            </div>
          )
        ) : (
          <div className="map-placeholder">
            <p>Map preview</p>
            <p className="muted">Load a JSON export using Detect or Plot mode</p>
          </div>
        )}
      </main>
    </div>
  );
}
