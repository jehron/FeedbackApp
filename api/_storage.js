import { kv } from '@vercel/kv';

// Keys are prefixed to avoid collisions
const FEEDBACK_PREFIX = 'feedback:';
const CONVERSATION_PREFIX = 'conv:';

export async function saveFeedback(id, rawFeedback, sanitizedFeedback, senderName, recipientName, relationship) {
  const data = {
    id,
    rawFeedback,
    sanitizedFeedback,
    senderName: senderName || null,
    recipientName: recipientName || null,
    relationship: relationship || null,
    createdAt: new Date().toISOString()
  };
  // Store feedback with no expiration (persistent)
  await kv.set(`${FEEDBACK_PREFIX}${id}`, data);
}

export async function getFeedbackMetadata(id) {
  const feedback = await kv.get(`${FEEDBACK_PREFIX}${id}`);
  if (!feedback) return null;
  return {
    id: feedback.id,
    createdAt: feedback.createdAt,
    senderName: feedback.senderName,
    recipientName: feedback.recipientName,
    relationship: feedback.relationship
  };
}

export async function getSanitizedFeedback(id) {
  const feedback = await kv.get(`${FEEDBACK_PREFIX}${id}`);
  if (!feedback) return null;
  return {
    sanitizedFeedback: feedback.sanitizedFeedback,
    senderName: feedback.senderName,
    recipientName: feedback.recipientName,
    relationship: feedback.relationship
  };
}

export async function getConversation(key) {
  const history = await kv.get(`${CONVERSATION_PREFIX}${key}`);
  return history || [];
}

export async function setConversation(key, history) {
  // Conversations expire after 1 hour
  await kv.set(`${CONVERSATION_PREFIX}${key}`, history, { ex: 3600 });
}
