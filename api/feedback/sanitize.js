import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const SANITIZE_SYSTEM_PROMPT = `You are a feedback sanitizer. Your job is to extract the core themes and key points from feedback while removing any identifying language patterns.

Your output should:
- Preserve the emotional tone and main message
- Remove specific phrasing, quotes, or identifiable language patterns
- Output a neutral summary that captures WHAT is being communicated, not HOW it was originally written
- Be written in third person (e.g., "The feedback expresses..." or "Key themes include...")
- Not include any meta-commentary about the sanitization process

Output ONLY the sanitized feedback summary, nothing else.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { feedback } = req.body;

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    if (feedback.length > 10000) {
      return res.status(400).json({ error: 'Feedback is too long (max 10000 characters)' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SANITIZE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Please sanitize the following feedback:\n\n${feedback}`
        }
      ]
    });

    res.json({ sanitized: message.content[0].text });
  } catch (error) {
    console.error('Sanitization error:', error);
    res.status(500).json({ error: 'Failed to sanitize feedback' });
  }
}
