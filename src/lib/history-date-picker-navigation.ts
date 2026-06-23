export type HistoryDatePickerOpenPayload = {
  selectedDateKey: string;
};

let pendingOpen: HistoryDatePickerOpenPayload | null = null;
let pendingResult: string | null = null;

export function queueHistoryDatePickerOpen(
  payload: HistoryDatePickerOpenPayload,
): void {
  pendingOpen = payload;
}

export function consumeHistoryDatePickerOpen(): HistoryDatePickerOpenPayload | null {
  const payload = pendingOpen;
  pendingOpen = null;
  return payload;
}

export function queueHistoryDatePickerResult(dateKey: string): void {
  pendingResult = dateKey;
}

export function consumeHistoryDatePickerResult(): string | null {
  const result = pendingResult;
  pendingResult = null;
  return result;
}
