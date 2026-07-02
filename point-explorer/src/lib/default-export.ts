/** Dev default — served from repo `__personal__/` via Vite middleware. */
export const DEFAULT_EXPORT_PATH = '/__personal__/original-data-all.json';
export const DEFAULT_EXPORT_NAME = 'original-data-all.json';

let defaultExportLoadStarted = false;

/** Avoid duplicate fetches when React Strict Mode remounts. */
export function markDefaultExportLoadStarted(): boolean {
  if (defaultExportLoadStarted) {
    return false;
  }
  defaultExportLoadStarted = true;
  return true;
}
