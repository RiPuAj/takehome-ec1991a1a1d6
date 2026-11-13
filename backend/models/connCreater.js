import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

export const db = new DatabaseSync(process.env.DATABASE_URL || 'database.db');
db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf-8'));

