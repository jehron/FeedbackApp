import { put, list, del } from '@vercel/blob';

const FEEDBACK_PREFIX = 'feedback/';
const CONVERSATION_PREFIX = 'conversations/';
const CONVERSATION_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getBlob(pathname) {
  const { blobs } = await list({ prefix: pathname, limit: 1 });
  if (blobs.length === 0) return null;

  const response = await fetch(blobs[0].url);
  if (!response.ok) return null;
  return response.json();
}

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

  await put(`${FEEDBACK_PREFIX}${id}.json`, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false
  });
}

export async function getFeedbackMetadata(id) {
  const feedback = await getBlob(`${FEEDBACK_PREFIX}${id}.json`);
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
  const feedback = await getBlob(`${FEEDBACK_PREFIX}${id}.json`);
  if (!feedback) return null;
  return {
    sanitizedFeedback: feedback.sanitizedFeedback,
    senderName: feedback.senderName,
    recipientName: feedback.recipientName,
    relationship: feedback.relationship
  };
}

export async function getConversation(key) {
  const data = await getBlob(`${CONVERSATION_PREFIX}${key}.json`);
  if (!data) return [];

  // Check if conversation has expired
  if (data.expiresAt && Date.now() > data.expiresAt) {
    // Clean up expired conversation
    const { blobs } = await list({ prefix: `${CONVERSATION_PREFIX}${key}.json`, limit: 1 });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
    return [];
  }

  return data.history || [];
}

export async function setConversation(key, history) {
  const data = {
    history,
    expiresAt: Date.now() + CONVERSATION_TTL_MS
  };

  await put(`${CONVERSATION_PREFIX}${key}.json`, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false
  });
}
