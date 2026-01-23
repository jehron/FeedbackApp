import Anthropic from '@anthropic-ai/sdk';
import { logError } from '../_logger.js';
import { rateLimit } from '../_ratelimit.js';
import {
  LLM_MODEL,
  ANALYZE_QUALITY_MAX_TOKENS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
  ANALYZE_QUALITY_SYSTEM_PROMPT
} from '../_constants.js';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { allowed, remaining, retryAfter } = rateLimit(req, 'analyze');
  res.setHeader('X-RateLimit-Remaining', remaining);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter });
  }

  const feedback = req.body?.feedback;
  console.log('═══ ANALYZE QUALITY ═══');
  console.log('Input length:', feedback?.length || 0, 'chars');

  try {
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      console.log('Result: REJECTED - empty input');
      console.log('═══════════════════════');
      return res.status(400).json({ error: 'Feedback is required' });
    }

    if (feedback.length < FEEDBACK_MIN_LENGTH) {
      console.log('Result: REJECTED - too short');
      console.log('═══════════════════════');
      return res.status(400).json({ error: `Feedback must be at least ${FEEDBACK_MIN_LENGTH} characters` });
    }

    if (feedback.length > FEEDBACK_MAX_LENGTH) {
      console.log('Result: REJECTED - too long');
      console.log('═══════════════════════');
      return res.status(400).json({ error: `Feedback is too long (max ${FEEDBACK_MAX_LENGTH} characters)` });
    }

    const message = await anthropic.messages.create({
      model: LLM_MODEL,
      max_tokens: ANALYZE_QUALITY_MAX_TOKENS,
      system: ANALYZE_QUALITY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Please analyze the quality of this feedback:\n\n${feedback}`
        }
      ]
    });

    let responseText = message.content[0].text;
    console.log('Claude response:');
    console.log(responseText);

    // Strip markdown code blocks if present
    responseText = responseText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    try {
      const analysis = JSON.parse(responseText);
      console.log('Parse: SUCCESS');
      console.log('═══════════════════════');
      res.json(analysis);
    } catch (parseError) {
      console.error('Parse: FAILED -', parseError.message);
      console.error('═══════════════════════');

      // Return a default structure
      res.json({
        overallScore: 5,
        elements: {
          situation: { present: false, detail: 'Unable to analyze' },
          behavior: { present: false, detail: 'Unable to analyze' },
          impact: { present: false, detail: 'Unable to analyze' },
          request: { present: false, detail: 'Unable to analyze' }
        },
        suggestions: ['Try adding more specific details about when and where this occurred.']
      });
    }
  } catch (error) {
    logError('/api/feedback/analyze-quality', error, {
      'Input length': `${feedback?.length || 0} chars`
    });
    res.status(500).json({ error: error.message || 'Failed to analyze feedback quality' });
  }
}
