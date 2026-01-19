import { kv } from '@vercel/kv';

// Keys are prefixed to avoid collisions
const FEEDBACK_PREFIX = 'feedback:';
const CONVERSATION_PREFIX = 'conv:';

export async function saveFeedback(id, rawFeedback, sanitizedFeedback) {
  const data = {
    id,
    rawFeedback,
    sanitizedFeedback,
    createdAt: new Date().toISOString()
  };
  // Store feedback with no expiration (persistent)
  await kv.set(`${FEEDBACK_PREFIX}${id}`, data);
}

export async function getFeedbackMetadata(id) {
  const feedback = await kv.get(`${FEEDBACK_PREFIX}${id}`);
  if (!feedback) return null;
  return { id: feedback.id, createdAt: feedback.createdAt };
}

export async function getSanitizedFeedback(id) {
  const feedback = await kv.get(`${FEEDBACK_PREFIX}${id}`);
  return feedback?.sanitizedFeedback;
}

export async function getConversation(key) {
  const history = await kv.get(`${CONVERSATION_PREFIX}${key}`);
  return history || [];
}

export async function setConversation(key, history) {
  // Conversations expire after 1 hour
  await kv.set(`${CONVERSATION_PREFIX}${key}`, history, { ex: 3600 });
}
