import fs from 'node:fs';
import path from 'node:path';

export const PERSONAL_DIR = path.join(__dirname, '..', '..', '__personal__');
export const ALL_DATA_EXPORT_PATH = path.join(PERSONAL_DIR, 'all data.json');

export function hasAllDataExport(): boolean {
  return fs.existsSync(ALL_DATA_EXPORT_PATH);
}
