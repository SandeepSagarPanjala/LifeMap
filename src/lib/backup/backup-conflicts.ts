import type {BackupBundleTables} from './backup-export';

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
      if (!Number.isFinite(timestamp) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }
      return {
        key: locationPointKey(timestamp, lat, lng),
        source: String(record.source ?? ''),
        accuracy:
          record.accuracy == null ? null : Number(record.accuracy),
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
        caption:
          typeof record.caption === 'string' ? record.caption : null,
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
      return {key, value};
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
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
  localSettings: Array<{key: string; value: string | null}>;
}): RestoreConflict[] {
  const conflicts: RestoreConflict[] = [];

  const localPoints = new Map(
    input.localLocationPoints.map(row => [
      locationPointKey(row.timestamp.getTime(), row.lat, row.lng),
      row,
    ]),
  );

  for (const backupRow of parseBackupLocationRows(input.backupTables.location_points)) {
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
    conflicts.push({
      id: `location_point:${backupRow.key}`,
      kind: 'location_point',
      title: 'Overlapping location point',
      backupDetail: `Backup: ${backupRow.source}`,
      localDetail: `This device: ${local.source}`,
    });
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

  for (const backupRow of parseBackupMomentRows(input.backupTables.moments)) {
    const local = localMoments.get(backupRow.key);
    if (!local) {
      continue;
    }
    const sameCaption = (local.caption ?? '') === (backupRow.caption ?? '');
    if (sameCaption) {
      continue;
    }
    conflicts.push({
      id: `moment:${backupRow.key}`,
      kind: 'moment',
      title: `${backupRow.type} moment overlap`,
      backupDetail: backupRow.caption ?? backupRow.textBody ?? 'Backup memory',
      localDetail: local.caption ?? local.textBody ?? 'Memory on this device',
    });
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
