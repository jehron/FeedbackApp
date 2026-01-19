import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeFeedback } from '../api';

function Home() {
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.trim() || !senderName.trim() || !recipientName.trim() || !relationship.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { sanitized } = await sanitizeFeedback(feedback);
      navigate('/preview', {
        state: {
          rawFeedback: feedback,
          sanitizedFeedback: sanitized,
          senderName: senderName.trim(),
          recipientName: recipientName.trim(),
          relationship: relationship.trim()
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1>Share Feedback</h1>
        <p className="subtitle">
          Write your feedback below. The recipient will receive it transformed into their preferred format.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="name-fields">
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your name"
              required
              disabled={loading}
            />
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient's name"
              required
              disabled={loading}
            />
          </div>

          <input
            type="text"
            className="relationship-field"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Your relationship (e.g., manager, peer, friend)"
            required
            disabled={loading}
          />

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Write your feedback here. Be honest and thoughtful. The recipient won't see your exact words - they'll receive the key themes in a format they choose."
            disabled={loading}
          />

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading || !feedback.trim() || !senderName.trim() || !recipientName.trim() || !relationship.trim()}>
            {loading ? <span className="loading">Processing</span> : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Home;
