export function computeDatabaseFileStats(
  pageCount: number,
  pageSize: number,
  freelistCount: number,
): {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
} {
  const totalBytes = pageCount * pageSize;
  const freeBytes = freelistCount * pageSize;
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  return {totalBytes, freeBytes, usedBytes};
}
