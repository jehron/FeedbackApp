import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

function Share() {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/feedback/${id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1>Your Link is Ready</h1>
        <p className="subtitle">
          Share this link with the person you want to receive your feedback.
        </p>

        <div className="share-link">{shareUrl}</div>

        {copied && <div className="success">Link copied to clipboard!</div>}

        <button onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
          The recipient will be able to request your feedback in different formats (poem, song, bullet points, etc.) but won't see your original words.
        </p>

        <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: '1rem', color: '#667eea' }}>
          Send more feedback
        </Link>
      </div>
    </div>
  );
}

export default Share;
