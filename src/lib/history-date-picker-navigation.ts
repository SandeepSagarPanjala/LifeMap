/** Result hand-off when the date picker half-sheet closes back to the map. */

let pendingResult: string | null = null;

export function queueHistoryDatePickerResult(dateKey: string): void {
  pendingResult = dateKey;
}

export function consumeHistoryDatePickerResult(): string | null {
  const result = pendingResult;
  pendingResult = null;
  return result;
}
