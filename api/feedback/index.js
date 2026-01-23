import { nanoid } from 'nanoid';
import { saveFeedback } from '../_storage.js';
import { logError } from '../_logger.js';
import { rateLimit } from '../_ratelimit.js';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_ID_LENGTH } from '../_constants.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { allowed, remaining, retryAfter } = rateLimit(req, 'save');
  res.setHeader('X-RateLimit-Remaining', remaining);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter });
  }

  const { rawFeedback, sanitizedFeedback, senderName, recipientName, relationship } = req.body || {};
  console.log('═══ SAVE FEEDBACK ═══');
  console.log('Sender:', senderName || '(not provided)');
  console.log('Recipient:', recipientName || '(not provided)');
  console.log('Raw length:', rawFeedback?.length || 0, 'chars');

  try {
    if (!rawFeedback || !sanitizedFeedback) {
      console.log('Result: REJECTED - missing data');
      console.log('═════════════════════');
      return res.status(400).json({ error: 'Both raw and sanitized feedback are required' });
    }

    if (rawFeedback.length > FEEDBACK_MAX_LENGTH || sanitizedFeedback.length > FEEDBACK_MAX_LENGTH) {
      console.log('Result: REJECTED - too long');
      console.log('═════════════════════');
      return res.status(400).json({ error: 'Feedback exceeds maximum length' });
    }

    const id = nanoid(FEEDBACK_ID_LENGTH);
    await saveFeedback(id, rawFeedback, sanitizedFeedback, senderName, recipientName, relationship);

    console.log('Result: SUCCESS - ID:', id);
    console.log('═════════════════════');
    res.json({ id });
  } catch (error) {
    logError('/api/feedback (POST)', error, {
      'Sender': senderName || '(not provided)',
      'Recipient': recipientName || '(not provided)',
      'Raw feedback length': `${rawFeedback?.length || 0} chars`
    });
    res.status(500).json({ error: error.message || 'Failed to save feedback' });
  }
}
