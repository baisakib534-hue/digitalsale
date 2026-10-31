import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { seedIfEmpty } from '../db/seed';
import { runMigrations } from '../db/migrate';

let db: Database.Database | null = null;

export function dbPath(): string {
  return process.env.MOSSHAW_DB_PATH || join(process.cwd(), 'data', 'mosshaw.db');
}

function schemaPath(): string {
  return join(process.cwd(), 'db', 'schema.sql');
}

/**
 * Singleton SQLite connection (WAL mode). Applies schema.sql idempotently
 * and seeds demo content on first boot. Override the file with
 * MOSSHAW_DB_PATH (used by tests).
 */
export function getDb(): Database.Database {
  if (db) return db;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(schemaPath(), 'utf8');
  db.exec(schema);
  runMigrations(db);
  seedIfEmpty(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function dbExists(): boolean {
  return existsSync(dbPath());
}
