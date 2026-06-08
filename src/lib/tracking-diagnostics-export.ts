import type {TrackingEventRow} from '@/db/repositories/tracking-events';

export type TrackingDiagnosticsPayload = {
  exportedAt: string;
  table: 'tracking_events';
  rowCount: number;
  rows: Array<{
    id: number;
    timestamp: string;
    event: string;
    details: Record<string, unknown> | null;
  }>;
};

export function buildTrackingDiagnosticsPayload(
  events: TrackingEventRow[],
): TrackingDiagnosticsPayload {
  const sorted = [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  return {
    exportedAt: new Date().toISOString(),
    table: 'tracking_events',
    rowCount: sorted.length,
    rows: sorted.map(event => ({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      event: event.event,
      details: event.details,
    })),
  };
}

export function buildTrackingDiagnosticsJson(events: TrackingEventRow[]): string {
  return JSON.stringify(buildTrackingDiagnosticsPayload(events), null, 2);
}

export function diagnosticsExportFileLabel(): string {
  return 'lifemap-tracking-diagnostics.json';
}
