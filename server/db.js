import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'feedback.db'));

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS feedbacks (
    id TEXT PRIMARY KEY,
    raw_feedback TEXT NOT NULL,
    sanitized_feedback TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function saveFeedback(id, rawFeedback, sanitizedFeedback) {
  const stmt = db.prepare(`
    INSERT INTO feedbacks (id, raw_feedback, sanitized_feedback)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, rawFeedback, sanitizedFeedback);
}

export function getFeedbackMetadata(id) {
  const stmt = db.prepare(`
    SELECT id, created_at FROM feedbacks WHERE id = ?
  `);
  return stmt.get(id);
}

export function getSanitizedFeedback(id) {
  const stmt = db.prepare(`
    SELECT sanitized_feedback FROM feedbacks WHERE id = ?
  `);
  const result = stmt.get(id);
  return result?.sanitized_feedback;
}

export default db;
