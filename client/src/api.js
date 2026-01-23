const API_BASE = '/api';

async function parseErrorResponse(response, fallbackMessage) {
  try {
    const error = await response.json();
    return error.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function sanitizeFeedback(feedback) {
  const response = await fetch(`${API_BASE}/feedback/sanitize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response, 'Failed to sanitize feedback'));
  }

  return response.json();
}

export async function saveFeedback(rawFeedback, sanitizedFeedback, senderName, recipientName, relationship) {
  const response = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawFeedback, sanitizedFeedback, senderName, recipientName, relationship })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response, 'Failed to save feedback'));
  }

  return response.json();
}

export async function getFeedbackMetadata(id) {
  const response = await fetch(`${API_BASE}/feedback/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(await parseErrorResponse(response, 'Failed to get feedback'));
  }

  return response.json();
}

export async function transformFeedback(id, format, conversationId = null) {
  const response = await fetch(`${API_BASE}/feedback/${id}/transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, conversationId })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response, 'Failed to transform feedback'));
  }

  return response.json();
}

export async function analyzeFeedbackQuality(feedback) {
  const response = await fetch(`${API_BASE}/feedback/analyze-quality`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback })
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response, 'Failed to analyze feedback quality'));
  }

  return response.json();
}
