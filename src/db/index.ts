import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS, TABLES } from './schema';

export const DB_NAME = 'pace.db';

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.execAsync(MIGRATIONS[version]);
    version++;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

/** Borra TODOS los datos locales (vuelve al onboarding). */
export async function resetDatabase(db: SQLiteDatabase) {
  await db.execAsync(TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join('\n') + '\nPRAGMA user_version = 0;');
  await migrate(db);
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
