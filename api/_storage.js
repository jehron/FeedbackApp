import { put, list, del } from '@vercel/blob';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const FEEDBACK_PREFIX = 'feedback/';
const CONVERSATION_PREFIX = 'conversations/';
const CONVERSATION_TTL_MS = 60 * 60 * 1000; // 1 hour
const FEEDBACK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Note: Vercel Blob only supports public access. Security relies on:
// 1. Unique blob store ID (not guessable)
// 2. Random feedback IDs (10 chars from nanoid)

// Use local file storage if no blob token (local development)
const USE_LOCAL_STORAGE = !process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_STORAGE_DIR = '/tmp/feedback-app-storage';

if (USE_LOCAL_STORAGE && !existsSync(LOCAL_STORAGE_DIR)) {
  mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

function getLocalPath(pathname) {
  return join(LOCAL_STORAGE_DIR, pathname.replace(/\//g, '_'));
}

async function getBlob(pathname) {
  if (USE_LOCAL_STORAGE) {
    const localPath = getLocalPath(pathname);
    if (!existsSync(localPath)) return null;
    try {
      return JSON.parse(readFileSync(localPath, 'utf8'));
    } catch {
      return null;
    }
  }

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
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + FEEDBACK_TTL_MS
  };

  if (USE_LOCAL_STORAGE) {
    writeFileSync(getLocalPath(`${FEEDBACK_PREFIX}${id}.json`), JSON.stringify(data));
    return;
  }

  await put(`${FEEDBACK_PREFIX}${id}.json`, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false
  });
}

export async function getFeedbackMetadata(id) {
  const feedback = await getBlob(`${FEEDBACK_PREFIX}${id}.json`);
  if (!feedback) return null;

  // Check if feedback has expired
  if (feedback.expiresAt && Date.now() > feedback.expiresAt) {
    await deleteFeedback(id);
    return null;
  }

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

  // Check if feedback has expired
  if (feedback.expiresAt && Date.now() > feedback.expiresAt) {
    await deleteFeedback(id);
    return null;
  }

  return {
    sanitizedFeedback: feedback.sanitizedFeedback,
    senderName: feedback.senderName,
    recipientName: feedback.recipientName,
    relationship: feedback.relationship
  };
}

async function deleteFeedback(id) {
  if (USE_LOCAL_STORAGE) {
    const localPath = getLocalPath(`${FEEDBACK_PREFIX}${id}.json`);
    if (existsSync(localPath)) unlinkSync(localPath);
    return;
  }

  const { blobs } = await list({ prefix: `${FEEDBACK_PREFIX}${id}.json`, limit: 1 });
  if (blobs.length > 0) {
    await del(blobs[0].url);
  }
}

export async function getConversation(key) {
  const data = await getBlob(`${CONVERSATION_PREFIX}${key}.json`);
  if (!data) return [];

  // Check if conversation has expired
  if (data.expiresAt && Date.now() > data.expiresAt) {
    if (USE_LOCAL_STORAGE) {
      const localPath = getLocalPath(`${CONVERSATION_PREFIX}${key}.json`);
      if (existsSync(localPath)) unlinkSync(localPath);
    } else {
      const { blobs } = await list({ prefix: `${CONVERSATION_PREFIX}${key}.json`, limit: 1 });
      if (blobs.length > 0) {
        await del(blobs[0].url);
      }
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

  if (USE_LOCAL_STORAGE) {
    writeFileSync(getLocalPath(`${CONVERSATION_PREFIX}${key}.json`), JSON.stringify(data));
    return;
  }

  await put(`${CONVERSATION_PREFIX}${key}.json`, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false
  });
}
