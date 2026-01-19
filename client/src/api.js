const API_BASE = '/api';

export async function sanitizeFeedback(feedback) {
  const response = await fetch(`${API_BASE}/feedback/sanitize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to sanitize feedback');
  }

  return response.json();
}

export async function saveFeedback(rawFeedback, sanitizedFeedback) {
  const response = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawFeedback, sanitizedFeedback })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save feedback');
  }

  return response.json();
}

export async function getFeedbackMetadata(id) {
  const response = await fetch(`${API_BASE}/feedback/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to get feedback');
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
    const error = await response.json();
    throw new Error(error.error || 'Failed to transform feedback');
  }

  return response.json();
}
