import {getLocationDayFingerprint} from '@/db/repositories/location-days';
import {getMomentsDayFingerprint} from '@/db/repositories/moments';

/** Cache key for history timeline — location points plus captured moments. */
export async function getDayHistoryFingerprint(
  dateKey: string,
): Promise<string> {
  const [locationFingerprint, momentsFingerprint] = await Promise.all([
    getLocationDayFingerprint(dateKey),
    getMomentsDayFingerprint(dateKey),
  ]);
  return `${locationFingerprint}|${momentsFingerprint}`;
}
