import { nanoid } from 'nanoid';
import { saveFeedback } from '../_storage.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rawFeedback, sanitizedFeedback, senderName, recipientName, relationship } = req.body;

    if (!rawFeedback || !sanitizedFeedback) {
      return res.status(400).json({ error: 'Both raw and sanitized feedback are required' });
    }

    const id = nanoid(10);
    await saveFeedback(id, rawFeedback, sanitizedFeedback, senderName, recipientName, relationship);

    res.json({ id });
  } catch (error) {
    console.error('Save error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Failed to save feedback' });
  }
}
