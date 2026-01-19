import Anthropic from '@anthropic-ai/sdk';
import {
  LLM_MODEL,
  SANITIZE_MAX_TOKENS,
  TRANSFORM_MAX_TOKENS,
  SANITIZE_SYSTEM_PROMPT,
  TRANSFORM_SYSTEM_PROMPT
} from './constants.js';

// Lazy-initialize to ensure env vars are loaded first
let anthropic;
function getClient() {
  if (!anthropic) {
    anthropic = new Anthropic();
  }
  return anthropic;
}

export async function sanitizeFeedback(rawFeedback) {
  const message = await getClient().messages.create({
    model: LLM_MODEL,
    max_tokens: SANITIZE_MAX_TOKENS,
    system: SANITIZE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Please sanitize the following feedback:\n\n${rawFeedback}`
      }
    ]
  });

  return message.content[0].text;
}

export async function transformFeedback(sanitizedFeedback, formatRequest, conversationHistory = [], senderName = null, recipientName = null, relationship = null) {
  const messages = [
    ...conversationHistory,
    {
      role: 'user',
      content: formatRequest
    }
  ];

  // If this is the first message, prepend context about the feedback
  if (conversationHistory.length === 0) {
    const senderLabel = senderName || 'Someone';
    const relationshipContext = relationship ? ` (your ${relationship})` : '';
    const recipientIntro = recipientName ? `Hi ${recipientName}! ` : '';
    messages[0] = {
      role: 'user',
      content: `${recipientIntro}${senderLabel}${relationshipContext} has feedback they want to share with me. Please help me receive it.\n\nFeedback themes:\n${sanitizedFeedback}\n\n---\n\nMy request: ${formatRequest}`
    };
  }

  const message = await getClient().messages.create({
    model: LLM_MODEL,
    max_tokens: TRANSFORM_MAX_TOKENS,
    system: TRANSFORM_SYSTEM_PROMPT,
    messages
  });

  return message.content[0].text;
}
