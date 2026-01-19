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
    sender_name TEXT,
    recipient_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: add name columns if they don't exist
function addColumnIfNotExists(columnName, columnType) {
  try {
    db.exec(`ALTER TABLE feedbacks ADD COLUMN ${columnName} ${columnType}`);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }
}

addColumnIfNotExists('sender_name', 'TEXT');
addColumnIfNotExists('recipient_name', 'TEXT');
addColumnIfNotExists('relationship', 'TEXT');

export function saveFeedback(id, rawFeedback, sanitizedFeedback, senderName, recipientName, relationship) {
  const stmt = db.prepare(`
    INSERT INTO feedbacks (id, raw_feedback, sanitized_feedback, sender_name, recipient_name, relationship)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, rawFeedback, sanitizedFeedback, senderName || null, recipientName || null, relationship || null);
}

export function getFeedbackMetadata(id) {
  const stmt = db.prepare(`
    SELECT id, sender_name, recipient_name, relationship, created_at FROM feedbacks WHERE id = ?
  `);
  return stmt.get(id);
}

export function getSanitizedFeedback(id) {
  const stmt = db.prepare(`
    SELECT sanitized_feedback, sender_name, recipient_name, relationship FROM feedbacks WHERE id = ?
  `);
  return stmt.get(id);
}

export default db;
