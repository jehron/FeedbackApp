import Anthropic from '@anthropic-ai/sdk';
import { logError } from '../_logger.js';
import { rateLimit } from '../_ratelimit.js';
import {
  LLM_MODEL,
  SANITIZE_MAX_TOKENS,
  FEEDBACK_MAX_LENGTH,
  SANITIZE_SYSTEM_PROMPT
} from '../_constants.js';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { allowed, remaining, retryAfter } = rateLimit(req, 'sanitize');
  res.setHeader('X-RateLimit-Remaining', remaining);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter });
  }

  const feedback = req.body?.feedback;
  console.log('═══ SANITIZE ═══');
  console.log('Input length:', feedback?.length || 0, 'chars');

  try {
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      console.log('Result: REJECTED - empty input');
      console.log('═════════════════');
      return res.status(400).json({ error: 'Feedback is required' });
    }

    if (feedback.length > FEEDBACK_MAX_LENGTH) {
      console.log('Result: REJECTED - too long');
      console.log('═════════════════');
      return res.status(400).json({ error: `Feedback is too long (max ${FEEDBACK_MAX_LENGTH} characters)` });
    }

    const message = await anthropic.messages.create({
      model: LLM_MODEL,
      max_tokens: SANITIZE_MAX_TOKENS,
      system: SANITIZE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Please sanitize the following feedback:\n\n${feedback}`
        }
      ]
    });

    console.log('Result: SUCCESS');
    console.log('═════════════════');
    res.json({ sanitized: message.content[0].text });
  } catch (error) {
    logError('/api/feedback/sanitize', error, {
      'Input length': `${feedback?.length || 0} chars`
    });
    res.status(500).json({ error: error.message || 'Failed to sanitize feedback' });
  }
}
