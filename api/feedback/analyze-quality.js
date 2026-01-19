import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const ANALYZE_QUALITY_SYSTEM_PROMPT = `You are a feedback quality analyzer using the SBI (Situation-Behavior-Impact) framework.

Analyze the feedback and return a JSON object with this exact structure:
{
  "overallScore": <number 1-10>,
  "elements": {
    "situation": { "present": <boolean>, "detail": "<brief explanation>" },
    "behavior": { "present": <boolean>, "detail": "<brief explanation>" },
    "impact": { "present": <boolean>, "detail": "<brief explanation>" }
  },
  "suggestions": ["<suggestion 1>", "<suggestion 2>"]
}

SBI Framework:
- SITUATION: When/where did this happen? Context like "In yesterday's meeting" or "During the project review"
- BEHAVIOR: What specific, observable actions occurred? Not interpretations, but what someone actually did or said
- IMPACT: What was the effect? How did it affect you, the team, or the outcome?

Scoring guidelines:
- 1-3: Missing most SBI elements, vague or generic
- 4-6: Has some elements but lacks specificity
- 7-8: Good coverage of SBI with specific details
- 9-10: Excellent, all elements present with clear, actionable detail

Provide 1-2 brief, actionable suggestions for improvement. Keep suggestions friendly and constructive.

Output ONLY the JSON object, no other text.`;

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
      max_tokens: 512,
      system: ANALYZE_QUALITY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Please analyze the quality of this feedback:\n\n${feedback}`
        }
      ]
    });

    const responseText = message.content[0].text;

    try {
      const analysis = JSON.parse(responseText);
      res.json(analysis);
    } catch {
      // If parsing fails, return a default structure
      res.json({
        overallScore: 5,
        elements: {
          situation: { present: false, detail: 'Unable to analyze' },
          behavior: { present: false, detail: 'Unable to analyze' },
          impact: { present: false, detail: 'Unable to analyze' }
        },
        suggestions: ['Try adding more specific details about when and where this occurred.']
      });
    }
  } catch (error) {
    console.error('Quality analysis error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Failed to analyze feedback quality' });
  }
}
