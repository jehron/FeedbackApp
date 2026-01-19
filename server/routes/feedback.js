import { Router } from 'express';
import { nanoid } from 'nanoid';
import { saveFeedback, getFeedbackMetadata, getSanitizedFeedback } from '../db.js';
import { sanitizeFeedback, transformFeedback } from '../llm.js';
import {
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_ID_LENGTH,
  CONVERSATION_ID_LENGTH,
  CONVERSATION_TTL_MS,
  MAX_CONVERSATIONS
} from '../constants.js';

const router = Router();

// In-memory conversation store (for simplicity - could use Redis in production)
const conversations = new Map();
const conversationTimers = new Map();

// Sanitize raw feedback and return preview
router.post('/sanitize', async (req, res) => {
  try {
    const { feedback } = req.body;

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    if (feedback.length > FEEDBACK_MAX_LENGTH) {
      return res.status(400).json({ error: `Feedback is too long (max ${FEEDBACK_MAX_LENGTH} characters)` });
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
    const { rawFeedback, sanitizedFeedback, senderName, recipientName, relationship } = req.body;

    if (!rawFeedback || !sanitizedFeedback) {
      return res.status(400).json({ error: 'Both raw and sanitized feedback are required' });
    }

    const id = nanoid(FEEDBACK_ID_LENGTH);
    saveFeedback(id, rawFeedback, sanitizedFeedback, senderName, recipientName, relationship);

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

    res.json({
      exists: true,
      createdAt: metadata.created_at,
      senderName: metadata.sender_name,
      recipientName: metadata.recipient_name,
      relationship: metadata.relationship
    });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

// Helper to clean up a conversation and its timer
function cleanupConversation(convKey) {
  conversations.delete(convKey);
  const timer = conversationTimers.get(convKey);
  if (timer) {
    clearTimeout(timer);
    conversationTimers.delete(convKey);
  }
}

// Remove oldest conversation when at capacity (LRU-style)
function evictOldestConversation() {
  const oldestKey = conversations.keys().next().value;
  if (oldestKey) {
    cleanupConversation(oldestKey);
  }
}

// Transform feedback into requested format
router.post('/:id/transform', async (req, res) => {
  try {
    const { id } = req.params;
    const { format, conversationId } = req.body;

    if (!format || typeof format !== 'string') {
      return res.status(400).json({ error: 'Format request is required' });
    }

    const feedbackData = getSanitizedFeedback(id);
    if (!feedbackData) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const { sanitized_feedback, sender_name, recipient_name, relationship } = feedbackData;

    // Get or create conversation history
    const isExistingConversation = conversationId && conversations.has(conversationId);
    let convKey = conversationId || `${id}-${nanoid(CONVERSATION_ID_LENGTH)}`;
    let history = conversations.get(convKey) || [];

    const response = await transformFeedback(sanitized_feedback, format, history, sender_name, recipient_name, relationship);

    // Build the initial message with personalization
    const senderLabel = sender_name || 'Someone';
    const relationshipContext = relationship ? ` (your ${relationship})` : '';
    const recipientIntro = recipient_name ? `Hi ${recipient_name}! ` : '';
    const initialMessage = `${recipientIntro}${senderLabel}${relationshipContext} has feedback they want to share with you. Here are the key themes:\n\n${sanitized_feedback}\n\n---\n\nMy request: ${format}`;

    // Update conversation history
    history = [
      ...history,
      { role: 'user', content: history.length === 0 ? initialMessage : format },
      { role: 'assistant', content: response }
    ];

    // Memory protection: evict oldest if at capacity and this is a new conversation
    if (!isExistingConversation && conversations.size >= MAX_CONVERSATIONS) {
      evictOldestConversation();
    }

    conversations.set(convKey, history);

    // Clear existing timer if any, then set new one
    const existingTimer = conversationTimers.get(convKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => cleanupConversation(convKey), CONVERSATION_TTL_MS);
    conversationTimers.set(convKey, timer);

    res.json({ response, conversationId: convKey });
  } catch (error) {
    console.error('Transform error:', error);
    res.status(500).json({ error: 'Failed to transform feedback' });
  }
});

export default router;
