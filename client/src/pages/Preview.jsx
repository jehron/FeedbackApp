import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { saveFeedback, sanitizeFeedback } from '../api';

function Preview() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedFeedback, setEditedFeedback] = useState('');

  // Redirect if no state
  if (!location.state?.rawFeedback) {
    return <Navigate to="/" replace />;
  }

  const { rawFeedback, sanitizedFeedback, senderName, recipientName, relationship } = location.state;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const { id } = await saveFeedback(rawFeedback, sanitizedFeedback, senderName, recipientName, relationship);
      navigate(`/share/${id}`, { state: { recipientName } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
    setEditedFeedback(rawFeedback);
  };

  const handleResanitize = async () => {
    setLoading(true);
    setError(null);

    try {
      const { sanitized } = await sanitizeFeedback(editedFeedback);
      navigate('/preview', {
        state: {
          rawFeedback: editedFeedback,
          sanitizedFeedback: sanitized,
          senderName,
          recipientName,
          relationship
        },
        replace: true
      });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1>Review Your Feedback</h1>
        <p className="subtitle">
          This is how your feedback will be summarized. The recipient will only see these themes, not your exact words.
        </p>

        {editing ? (
          <>
            <textarea
              value={editedFeedback}
              onChange={(e) => setEditedFeedback(e.target.value)}
              disabled={loading}
            />
            <div className="button-group">
              <button
                className="secondary"
                onClick={() => setEditing(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button onClick={handleResanitize} disabled={loading || !editedFeedback.trim()}>
                {loading ? <span className="loading">Processing</span> : 'Re-process'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sanitized-preview">
              <h3>What the recipient will receive</h3>
              <p>{sanitizedFeedback}</p>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="button-group">
              <button className="secondary" onClick={handleEdit} disabled={loading}>
                Edit Original
              </button>
              <button onClick={handleConfirm} disabled={loading}>
                {loading ? <span className="loading">Creating link</span> : 'Create Link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Preview;
