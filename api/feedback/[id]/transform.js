import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import { getSanitizedFeedback, getConversation, setConversation } from '../../_storage.js';
import { logError } from '../../_logger.js';
import { rateLimit } from '../../_ratelimit.js';
import {
  LLM_MODEL,
  TRANSFORM_MAX_TOKENS,
  CONVERSATION_ID_LENGTH,
  TRANSFORM_SYSTEM_PROMPT
} from '../../_constants.js';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { allowed, remaining, retryAfter } = rateLimit(req, 'transform');
  res.setHeader('X-RateLimit-Remaining', remaining);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter });
  }

  const { id } = req.query;
  const { format, conversationId } = req.body || {};
  console.log('═══ TRANSFORM ═══');
  console.log('Feedback ID:', id);
  console.log('Conversation ID:', conversationId || '(new)');
  console.log('Format request:', format?.substring(0, 50) + (format?.length > 50 ? '...' : ''));

  try {
    if (!format || typeof format !== 'string') {
      console.log('Result: REJECTED - no format');
      console.log('═════════════════');
      return res.status(400).json({ error: 'Format request is required' });
    }

    const feedbackData = await getSanitizedFeedback(id);
    if (!feedbackData) {
      console.log('Result: NOT FOUND');
      console.log('═════════════════');
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const { sanitizedFeedback, senderName, recipientName, relationship } = feedbackData;

    // Get or create conversation history
    let convKey = conversationId || `${id}-${nanoid(CONVERSATION_ID_LENGTH)}`;
    let history = await getConversation(convKey);

    // Build personalized initial message
    const senderLabel = senderName || 'Someone';
    const relationshipContext = relationship ? ` (your ${relationship})` : '';
    const recipientIntro = recipientName ? `Hi ${recipientName}! ` : '';
    const initialMessage = `${recipientIntro}${senderLabel}${relationshipContext} has feedback they want to share with me. Please help me receive it.\n\nFeedback themes:\n${sanitizedFeedback}\n\n---\n\nMy request: ${format}`;

    const messages = [
      ...history,
      {
        role: 'user',
        content: history.length === 0 ? initialMessage : format
      }
    ];

    const message = await anthropic.messages.create({
      model: LLM_MODEL,
      max_tokens: TRANSFORM_MAX_TOKENS,
      system: TRANSFORM_SYSTEM_PROMPT,
      messages
    });

    const response = message.content[0].text;

    // Update conversation history
    const newHistory = [
      ...history,
      {
        role: 'user',
        content: history.length === 0 ? initialMessage : format
      },
      { role: 'assistant', content: response }
    ];
    await setConversation(convKey, newHistory);

    console.log('Result: SUCCESS');
    console.log('═════════════════');
    res.json({ response, conversationId: convKey });
  } catch (error) {
    logError('/api/feedback/[id]/transform', error, {
      'Feedback ID': id || '(not provided)',
      'Conversation ID': conversationId || '(new conversation)',
      'Format request length': `${format?.length || 0} chars`
    });
    res.status(500).json({ error: 'Failed to transform feedback' });
  }
}
