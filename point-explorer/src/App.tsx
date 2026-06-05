import {useCallback, useEffect, useMemo, useState} from 'react';

import {PointsMap} from './components/PointsMap';
import {
  formatDateLabel,
  formatTimestamp,
  parseExport,
  uniqueDateKeys,
} from './lib/export';
import {
  adjacentPointId,
  indexOfPointId,
  sortPointsById,
} from './lib/point-nav';
import type {ParsedPoint} from './types';

import './App.css';

export function App() {
  const [allPoints, setAllPoints] = useState<ParsedPoint[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pointNavMode, setPointNavMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateKeys = useMemo(() => uniqueDateKeys(allPoints), [allPoints]);

  const filteredPoints = useMemo(() => {
    if (dateKey === 'all') {
      return allPoints;
    }
    return allPoints.filter(p => p.dateKey === dateKey);
  }, [allPoints, dateKey]);

  const pointsById = useMemo(
    () => sortPointsById(filteredPoints),
    [filteredPoints],
  );

  const selectedPoint = useMemo(
    () => filteredPoints.find(p => p.id === selectedId) ?? null,
    [filteredPoints, selectedId],
  );

  const selectedIdIndex = useMemo(
    () => indexOfPointId(pointsById, selectedId),
    [pointsById, selectedId],
  );

  const enterPointNav = useCallback(() => {
    if (pointsById.length === 0) {
      return;
    }
    setPointNavMode(true);
    if (selectedId == null) {
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

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseExport(JSON.parse(text));
      setAllPoints(parsed);
      setFileName(file.name);
      setDateKey('all');
      setSelectedId(null);
      setPointNavMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON');
      setAllPoints([]);
      setFileName(null);
      setPointNavMode(false);
    }
  }, []);

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

  const canGoPrev = adjacentPointId(pointsById, selectedId, -1) != null;
  const canGoNext = adjacentPointId(pointsById, selectedId, 1) != null;
  const prevPointId = adjacentPointId(pointsById, selectedId, -1);
  const nextPointId = adjacentPointId(pointsById, selectedId, 1);

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>Location Point Explorer</h1>
          <p className="subtitle">Internal tool — not part of LifeMap app</p>
        </header>

        <label className="file-btn">
          Load JSON export
          <input
            type="file"
            accept=".json,application/json"
            onChange={onFileChange}
            hidden
          />
        </label>

        <p className="hint">Drop <code>all data.json</code> anywhere on this page</p>

        {error ? <p className="error">{error}</p> : null}

        {fileName ? (
          <>
            <section className="meta">
              <div>
                <span className="label">File</span>
                <span>{fileName}</span>
              </div>
              <div>
                <span className="label">Total points</span>
                <span>{allPoints.length.toLocaleString()}</span>
              </div>
              <div>
                <span className="label">Showing</span>
                <span>{filteredPoints.length.toLocaleString()}</span>
              </div>
            </section>

            <label className="field">
              <span className="field-label">Date (America/Chicago)</span>
              <select
                value={dateKey}
                onChange={event => {
                  setDateKey(event.target.value);
                  setSelectedId(null);
                  setPointNavMode(false);
                }}>
                <option value="all">All dates ({dateKeys.length})</option>
                {dateKeys.map(key => (
                  <option key={key} value={key}>
                    {formatDateLabel(key)} (
                    {allPoints.filter(p => p.dateKey === key).length})
                  </option>
                ))}
              </select>
            </label>

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
                    on this date · by point ID
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
            ) : filteredPoints.length > 0 ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={enterPointNav}>
                Point-to-point navigation
              </button>
            ) : null}

            {selectedPoint ? (
              <section className="detail">
                <h2>Point #{selectedPoint.id}</h2>
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
              </section>
            ) : (
              <p className="muted">
                {pointNavMode
                  ? 'Select a point on the map or use the arrows.'
                  : 'Click a point on the map for details.'}
              </p>
            )}
          </>
        ) : (
          <p className="empty">Load an export to plot saved GPS rows.</p>
        )}
      </aside>

      <main
        className="map-panel"
        onDragOver={event => event.preventDefault()}
        onDrop={onDrop}>
        {allPoints.length > 0 ? (
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
              points={filteredPoints}
              selectedId={selectedId}
              onSelectId={setSelectedId}
              focusSelected={pointNavMode}
            />
          </>
        ) : (
          <div className="map-placeholder">
            <p>Map preview</p>
            <p className="muted">Load <strong>all data.json</strong> to see every save</p>
          </div>
        )}
      </main>
    </div>
  );
}
