import {useCallback, useMemo, useState} from 'react';

import {PointsMap} from './components/PointsMap';
import {
  formatDateLabel,
  formatTimestamp,
  parseExport,
  uniqueDateKeys,
} from './lib/export';
import type {ParsedPoint} from './types';

import './App.css';

export function App() {
  const [allPoints, setAllPoints] = useState<ParsedPoint[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateKeys = useMemo(() => uniqueDateKeys(allPoints), [allPoints]);

  const filteredPoints = useMemo(() => {
    if (dateKey === 'all') {
      return allPoints;
    }
    return allPoints.filter(p => p.dateKey === dateKey);
  }, [allPoints, dateKey]);

  const selectedPoint = useMemo(
    () => filteredPoints.find(p => p.id === selectedId) ?? null,
    [filteredPoints, selectedId],
  );

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseExport(JSON.parse(text));
      setAllPoints(parsed);
      setFileName(file.name);
      setDateKey('all');
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON');
      setAllPoints([]);
      setFileName(null);
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
              <p className="muted">Click a point on the map for details.</p>
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
          <PointsMap
            points={filteredPoints}
            selectedId={selectedId}
            onSelectId={setSelectedId}
          />
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
