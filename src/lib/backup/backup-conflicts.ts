import type { BackupBundleTables } from './backup-export';

export type RestoreConflictKind = 'location_point' | 'moment' | 'setting';

export type RestoreConflictChoice = 'backup' | 'local';

export type RestoreConflict = {
  id: string;
  kind: RestoreConflictKind;
  title: string;
  backupDetail: string;
  localDetail: string;
};

export function locationPointKey(
  timestampMs: number,
  lat: number,
  lng: number,
): string {
  return `${timestampMs}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
}

export function momentKey(
  timestampMs: number,
  type: string,
  contentPath: string | null,
  textBody: string | null,
): string {
  const body = textBody?.trim().slice(0, 80) ?? '';
  const path = contentPath?.trim() ?? '';
  return `${timestampMs}|${type}|${path}|${body}`;
}

export function settingKey(key: string): string {
  return key.trim();
}

function parseBackupLocationRows(rows: unknown[]) {
  return rows
    .map(row => {
      if (typeof row !== 'object' || row == null) {
        return null;
      }
      const record = row as Record<string, unknown>;
      const timestamp = Date.parse(String(record.timestamp ?? ''));
      const lat = Number(record.lat);
      const lng = Number(record.lng);
      if (
        !Number.isFinite(timestamp) ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return null;
      }
      return {
        key: locationPointKey(timestamp, lat, lng),
        source: String(record.source ?? ''),
        accuracy: record.accuracy == null ? null : Number(record.accuracy),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

function parseBackupMomentRows(rows: unknown[]) {
  return rows
    .map(row => {
      if (typeof row !== 'object' || row == null) {
        return null;
      }
      const record = row as Record<string, unknown>;
      const timestamp = Date.parse(String(record.timestamp ?? ''));
      const type = String(record.type ?? '');
      if (!Number.isFinite(timestamp) || !type) {
        return null;
      }
      const contentPath =
        typeof record.contentPath === 'string' ? record.contentPath : null;
      const textBody =
        typeof record.textBody === 'string' ? record.textBody : null;
      return {
        key: momentKey(timestamp, type, contentPath, textBody),
        type,
        contentPath,
        textBody,
        caption: typeof record.caption === 'string' ? record.caption : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

function parseBackupSettingRows(rows: unknown[]) {
  return rows
    .map(row => {
      if (typeof row !== 'object' || row == null) {
        return null;
      }
      const record = row as Record<string, unknown>;
      const key = typeof record.key === 'string' ? record.key.trim() : '';
      if (!key) {
        return null;
      }
      const value = record.value == null ? null : String(record.value);
      return { key, value };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

function summarizeLocationConflicts(count: number): RestoreConflict | null {
  if (count <= 0) {
    return null;
  }
  if (count === 1) {
    return {
      id: 'location_point:bulk',
      kind: 'location_point',
      title: 'Overlapping GPS point',
      backupDetail: 'Use the GPS point from backup',
      localDetail: 'Keep the GPS point on this device',
    };
  }
  return {
    id: 'location_point:bulk',
    kind: 'location_point',
    title: `${count.toLocaleString()} overlapping GPS points`,
    backupDetail: 'Use GPS points from backup where they overlap',
    localDetail: 'Keep GPS points already on this device where they overlap',
  };
}

function summarizeMomentConflicts(
  sample: RestoreConflict | null,
  count: number,
): RestoreConflict | null {
  if (count <= 0) {
    return null;
  }
  if (count === 1 && sample != null) {
    return sample;
  }
  return {
    id: 'moment:bulk',
    kind: 'moment',
    title: `${count.toLocaleString()} overlapping memories`,
    backupDetail: 'Use memories from backup where they overlap',
    localDetail: 'Keep memories already on this device where they overlap',
  };
}

export function detectRestoreConflicts(input: {
  backupTables: BackupBundleTables;
  localLocationPoints: Array<{
    timestamp: Date;
    lat: number;
    lng: number;
    source: string;
    accuracy: number | null;
  }>;
  localMoments: Array<{
    timestamp: Date;
    type: string;
    contentPath: string | null;
    textBody: string | null;
    caption: string | null;
  }>;
  localSettings: Array<{ key: string; value: string | null }>;
}): RestoreConflict[] {
  const conflicts: RestoreConflict[] = [];

  const localPoints = new Map(
    input.localLocationPoints.map(row => [
      locationPointKey(row.timestamp.getTime(), row.lat, row.lng),
      row,
    ]),
  );

  const seenLocationKeys = new Set<string>();
  let locationConflictCount = 0;

  for (const backupRow of parseBackupLocationRows(
    input.backupTables.location_points,
  )) {
    if (seenLocationKeys.has(backupRow.key)) {
      continue;
    }
    const local = localPoints.get(backupRow.key);
    if (!local) {
      continue;
    }
    const sameSource = local.source === backupRow.source;
    const sameAccuracy =
      (local.accuracy ?? null) === (backupRow.accuracy ?? null);
    if (sameSource && sameAccuracy) {
      continue;
    }
    seenLocationKeys.add(backupRow.key);
    locationConflictCount += 1;
  }

  const localMoments = new Map(
    input.localMoments.map(row => [
      momentKey(
        row.timestamp.getTime(),
        row.type,
        row.contentPath,
        row.textBody,
      ),
      row,
    ]),
  );

  const seenMomentKeys = new Set<string>();
  let momentConflictCount = 0;
  let sampleMomentConflict: RestoreConflict | null = null;

  for (const backupRow of parseBackupMomentRows(input.backupTables.moments)) {
    if (seenMomentKeys.has(backupRow.key)) {
      continue;
    }
    const local = localMoments.get(backupRow.key);
    if (!local) {
      continue;
    }
    const sameCaption = (local.caption ?? '') === (backupRow.caption ?? '');
    if (sameCaption) {
      continue;
    }
    seenMomentKeys.add(backupRow.key);
    momentConflictCount += 1;
    if (sampleMomentConflict == null) {
      sampleMomentConflict = {
        id: `moment:${backupRow.key}`,
        kind: 'moment',
        title: `${backupRow.type} moment overlap`,
        backupDetail:
          backupRow.caption ?? backupRow.textBody ?? 'Backup memory',
        localDetail: local.caption ?? local.textBody ?? 'Memory on this device',
      };
    }
  }

  const localSettings = new Map(
    input.localSettings.map(row => [settingKey(row.key), row.value]),
  );

  for (const backupRow of parseBackupSettingRows(input.backupTables.settings)) {
    const key = settingKey(backupRow.key);
    if (!localSettings.has(key)) {
      continue;
    }
    const localValue = localSettings.get(key) ?? null;
    if (localValue === backupRow.value) {
      continue;
    }
    conflicts.push({
      id: `setting:${key}`,
      kind: 'setting',
      title: `Setting: ${key}`,
      backupDetail: backupRow.value ?? '(empty)',
      localDetail: localValue ?? '(empty)',
    });
  }

  const locationSummary = summarizeLocationConflicts(locationConflictCount);
  if (locationSummary != null) {
    conflicts.unshift(locationSummary);
  }

  const momentSummary = summarizeMomentConflicts(
    sampleMomentConflict,
    momentConflictCount,
  );
  if (momentSummary != null) {
    conflicts.unshift(momentSummary);
  }

  return conflicts;
}

export function buildConflictResolutionMap(
  conflicts: RestoreConflict[],
  choices: Record<string, RestoreConflictChoice | undefined>,
): Map<string, RestoreConflictChoice> {
  const map = new Map<string, RestoreConflictChoice>();
  for (const conflict of conflicts) {
    map.set(conflict.id, choices[conflict.id] ?? 'local');
  }
  return map;
}

export function resolveRestoreConflictChoice(
  resolutions: Map<string, RestoreConflictChoice>,
  conflictId: string,
  bulkId: string,
): RestoreConflictChoice {
  return resolutions.get(conflictId) ?? resolutions.get(bulkId) ?? 'local';
}
