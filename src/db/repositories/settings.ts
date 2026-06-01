import {eq} from 'drizzle-orm';

import {getDatabase} from '../client';
import {settings} from '../schema';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);

  if (existing[0]) {
    await db.update(settings).set({value}).where(eq(settings.key, key));
    return;
  }

  await db.insert(settings).values({key, value});
}
