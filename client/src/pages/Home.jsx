import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeFeedback, analyzeFeedbackQuality } from '../api';

const FEEDBACK_MIN_LENGTH = 150;

// Client-side SBI pattern detection
function detectSBIElements(text) {
  // Situation patterns: time/place context
  const situationPatterns = [
    /\b(yesterday|today|last week|last month|this morning|during|at the|in the meeting|in our|when we|while)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    /\b(meeting|standup|review|presentation|discussion|call|session)\b/i
  ];

  // Behavior patterns: observable actions
  const behaviorPatterns = [
    /\b(you said|you did|you were|you made|you asked|you helped|you showed|you took|you gave|you sent)\b/i,
    /\b(spoke|talked|presented|explained|demonstrated|handled|responded|reacted|completed|delivered)\b/i,
    /\b(interrupted|listened|ignored|supported|challenged|questioned)\b/i
  ];

  // Impact patterns: effects/feelings
  const impactPatterns = [
    /\b(made me feel|felt|feeling|i felt|caused|resulted in|led to|helped me|affected|impact)\b/i,
    /\b(appreciated|frustrated|confused|motivated|inspired|disappointed|grateful|concerned|proud)\b/i,
    /\b(because of this|as a result|consequently|this meant|the outcome|the effect)\b/i
  ];

  return {
    situation: situationPatterns.some(p => p.test(text)),
    behavior: behaviorPatterns.some(p => p.test(text)),
    impact: impactPatterns.some(p => p.test(text))
  };
}

function Home() {
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // SBI guidance state
  const [charCount, setCharCount] = useState(0);
  const [sbiIndicators, setSbiIndicators] = useState({ situation: false, behavior: false, impact: false });
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [analyzingQuality, setAnalyzingQuality] = useState(false);
  const textareaRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced SBI detection
  const updateSBIIndicators = useCallback((text) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSbiIndicators(detectSBIElements(text));
    }, 300);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleFeedbackChange = (e) => {
    const text = e.target.value;
    setFeedback(text);
    setCharCount(text.length);
    if (text.length >= 50) {
      updateSBIIndicators(text);
    }
  };

  const proceedToSanitization = async () => {
    setShowQualityModal(false);
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

  const handleImprove = () => {
    setShowQualityModal(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.trim() || !senderName.trim() || !recipientName.trim() || !relationship.trim()) return;

    // Enforce minimum character count
    if (charCount < FEEDBACK_MIN_LENGTH) {
      setError(`Please write at least ${FEEDBACK_MIN_LENGTH} characters (currently ${charCount})`);
      return;
    }

    setError(null);
    setAnalyzingQuality(true);
    setShowQualityModal(true);

    try {
      const analysis = await analyzeFeedbackQuality(feedback);
      setQualityAnalysis(analysis);
    } catch (err) {
      // On error, proceed to sanitization anyway
      console.error('Quality analysis failed:', err);
      proceedToSanitization();
    } finally {
      setAnalyzingQuality(false);
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
            ref={textareaRef}
            value={feedback}
            onChange={handleFeedbackChange}
            placeholder="Write your feedback here. Be honest and thoughtful. The recipient won't see your exact words - they'll receive the key themes in a format they choose."
            disabled={loading}
          />

          {/* Character Counter */}
          <div className="char-counter">
            <div className="char-counter-bar">
              <div
                className="char-counter-fill"
                style={{ width: `${Math.min((charCount / FEEDBACK_MIN_LENGTH) * 100, 100)}%` }}
              />
            </div>
            <span className={`char-counter-text ${charCount >= FEEDBACK_MIN_LENGTH ? 'complete' : ''}`}>
              {charCount} / {FEEDBACK_MIN_LENGTH} minimum
            </span>
          </div>

          {/* SBI Indicator - shows after 50 chars */}
          {charCount >= 50 && (
            <div className="sbi-indicator">
              <span className="sbi-label">SBI Elements:</span>
              <div className="sbi-dots">
                <span className={`sbi-dot ${sbiIndicators.situation ? 'active' : ''}`} title="Situation">S</span>
                <span className={`sbi-dot ${sbiIndicators.behavior ? 'active' : ''}`} title="Behavior">B</span>
                <span className={`sbi-dot ${sbiIndicators.impact ? 'active' : ''}`} title="Impact">I</span>
              </div>
              <span className="sbi-hint">
                {!sbiIndicators.situation && !sbiIndicators.behavior && !sbiIndicators.impact
                  ? 'Add context: when, what happened, impact'
                  : !sbiIndicators.situation
                  ? 'Add when/where this happened'
                  : !sbiIndicators.behavior
                  ? 'Describe specific actions'
                  : !sbiIndicators.impact
                  ? 'Share how this affected you'
                  : 'Great coverage!'}
              </span>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading || !feedback.trim() || !senderName.trim() || !recipientName.trim() || !relationship.trim()}>
            {loading ? <span className="loading">Processing</span> : 'Continue'}
          </button>
        </form>
      </div>

      {/* Quality Analysis Modal */}
      {showQualityModal && (
        <div className="modal-overlay">
          <div className="quality-modal">
            {analyzingQuality ? (
              <div className="quality-loading">
                <span className="loading">Analyzing feedback quality</span>
              </div>
            ) : qualityAnalysis ? (
              <>
                <div className="quality-header">
                  <h2>Feedback Quality Analysis</h2>
                  <div className={`quality-score score-${Math.floor(qualityAnalysis.overallScore / 3)}`}>
                    {qualityAnalysis.overallScore}/10
                  </div>
                </div>

                <div className="quality-elements">
                  {Object.entries(qualityAnalysis.elements).map(([key, value]) => (
                    <div key={key} className={`quality-element ${value.present ? 'present' : 'missing'}`}>
                      <div className="element-header">
                        <span className={`element-indicator ${value.present ? 'present' : 'missing'}`}>
                          {value.present ? '✓' : '○'}
                        </span>
                        <span className="element-name">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      </div>
                      <p className="element-detail">{value.detail}</p>
                    </div>
                  ))}
                </div>

                {qualityAnalysis.suggestions && qualityAnalysis.suggestions.length > 0 && (
                  <div className="quality-suggestions">
                    <h3>Suggestions to improve:</h3>
                    <ul>
                      {qualityAnalysis.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="quality-actions">
                  <button className="secondary" onClick={handleImprove}>
                    Go Back & Improve
                  </button>
                  <button onClick={proceedToSanitization}>
                    Continue Anyway
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
