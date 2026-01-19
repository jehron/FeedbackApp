import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeFeedback } from '../api';

function Home() {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { sanitized } = await sanitizeFeedback(feedback);
      navigate('/preview', {
        state: {
          rawFeedback: feedback,
          sanitizedFeedback: sanitized
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
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Write your feedback here. Be honest and thoughtful. The recipient won't see your exact words - they'll receive the key themes in a format they choose."
            disabled={loading}
          />

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading || !feedback.trim()}>
            {loading ? <span className="loading">Processing</span> : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Home;
