import { Router } from 'express';
import { nanoid } from 'nanoid';
import { saveFeedback, getFeedbackMetadata, getSanitizedFeedback } from '../db.js';
import { sanitizeFeedback, transformFeedback } from '../llm.js';

const router = Router();

// In-memory conversation store (for simplicity - could use Redis in production)
const conversations = new Map();

// Sanitize raw feedback and return preview
router.post('/sanitize', async (req, res) => {
  try {
    const { feedback } = req.body;

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    if (feedback.length > 10000) {
      return res.status(400).json({ error: 'Feedback is too long (max 10000 characters)' });
    }

    const sanitized = await sanitizeFeedback(feedback);
    res.json({ sanitized });
  } catch (error) {
    console.error('Sanitization error:', error);
    res.status(500).json({ error: 'Failed to sanitize feedback' });
  }
});

// Save feedback and return shareable link ID
router.post('/', async (req, res) => {
  try {
    const { rawFeedback, sanitizedFeedback } = req.body;

    if (!rawFeedback || !sanitizedFeedback) {
      return res.status(400).json({ error: 'Both raw and sanitized feedback are required' });
    }

    const id = nanoid(10);
    saveFeedback(id, rawFeedback, sanitizedFeedback);

    res.json({ id });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Get feedback metadata (not content)
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const metadata = getFeedbackMetadata(id);

    if (!metadata) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ exists: true, createdAt: metadata.created_at });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

// Transform feedback into requested format
router.post('/:id/transform', async (req, res) => {
  try {
    const { id } = req.params;
    const { format, conversationId } = req.body;

    if (!format || typeof format !== 'string') {
      return res.status(400).json({ error: 'Format request is required' });
    }

    const sanitized = getSanitizedFeedback(id);
    if (!sanitized) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Get or create conversation history
    let convKey = conversationId || `${id}-${nanoid(6)}`;
    let history = conversations.get(convKey) || [];

    const response = await transformFeedback(sanitized, format, history);

    // Update conversation history
    history = [
      ...history,
      { role: 'user', content: history.length === 0
        ? `Here is feedback that someone wants to share with me. Please help me receive it.\n\nFeedback themes:\n${sanitized}\n\n---\n\nMy request: ${format}`
        : format
      },
      { role: 'assistant', content: response }
    ];
    conversations.set(convKey, history);

    // Clean up old conversations after 1 hour
    setTimeout(() => conversations.delete(convKey), 60 * 60 * 1000);

    res.json({ response, conversationId: convKey });
  } catch (error) {
    console.error('Transform error:', error);
    res.status(500).json({ error: 'Failed to transform feedback' });
  }
});

export default router;
