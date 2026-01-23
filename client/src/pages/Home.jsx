import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeFeedback, analyzeFeedbackQuality } from '../api';

const FEEDBACK_MIN_LENGTH = 150;

// Client-side SBI-R pattern detection
function detectSBIRElements(text) {
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

  // Request patterns: future behavior change
  const requestPatterns = [
    /\b(i'd appreciate|i would appreciate|it would help|could you|would you|i'd like|i would like|in the future|going forward|next time)\b/i,
    /\b(please consider|please try|i'm asking|my request|what i need|what would help)\b/i,
    /\b(instead of|rather than|it would be better if|i'd prefer)\b/i
  ];

  return {
    situation: situationPatterns.some(p => p.test(text)),
    behavior: behaviorPatterns.some(p => p.test(text)),
    impact: impactPatterns.some(p => p.test(text)),
    request: requestPatterns.some(p => p.test(text))
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

  // Writing mode toggle
  const [writeMode, setWriteMode] = useState('freeform'); // 'freeform' | 'guided'

  // How it works collapsible section
  const [howItWorksExpanded, setHowItWorksExpanded] = useState(false);

  // Guided mode state
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState({
    situation: '',
    behavior: '',
    impact: '',
    request: ''
  });

  // SBI guidance state
  const [charCount, setCharCount] = useState(0);
  const [sbiIndicators, setSbiIndicators] = useState({ situation: false, behavior: false, impact: false, request: false });
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [analyzingQuality, setAnalyzingQuality] = useState(false);
  const textareaRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced SBI-R detection
  const updateSBIIndicators = useCallback((text) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSbiIndicators(detectSBIRElements(text));
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

  // Guided mode configuration
  const guidedSteps = [
    {
      key: 'situation',
      title: 'What happened?',
      prompt: 'Describe the specific context or event',
      example: 'e.g., "During last Tuesday\'s team standup..." or "In our 1:1 yesterday..."'
    },
    {
      key: 'behavior',
      title: 'What did they do?',
      prompt: 'What actions or words did you observe?',
      example: 'e.g., "You interrupted two people mid-sentence..." or "You took the time to explain..."'
    },
    {
      key: 'impact',
      title: 'How did it affect things?',
      prompt: 'What was the result or how did it make you feel?',
      example: 'e.g., "This made me feel like my input wasn\'t valued..." or "The team felt more confident..."'
    },
    {
      key: 'request',
      title: 'What would you like them to do differently?',
      prompt: 'Share a specific request for future behavior (optional but helpful)',
      example: 'e.g., "In future standups, I\'d appreciate if you could let me finish my thoughts before sharing yours"',
      optional: true
    }
  ];

  const handleGuidedAnswerChange = (key, value) => {
    setGuidedAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleGuidedNext = () => {
    if (guidedStep < guidedSteps.length - 1) {
      setGuidedStep(guidedStep + 1);
    }
  };

  const handleGuidedBack = () => {
    if (guidedStep > 0) {
      setGuidedStep(guidedStep - 1);
    }
  };

  const combineGuidedFeedback = () => {
    const { situation, behavior, impact, request } = guidedAnswers;
    let combined = `${situation.trim()}\n\n${behavior.trim()}\n\n${impact.trim()}`;
    if (request.trim()) {
      combined += `\n\n${request.trim()}`;
    }
    return combined;
  };

  const isGuidedComplete = () => {
    const hasRequiredFields = guidedAnswers.situation.trim() && guidedAnswers.behavior.trim() && guidedAnswers.impact.trim();
    if (!hasRequiredFields) return false;
    // Ensure combined length meets minimum
    const combinedLength = combineGuidedFeedback().length;
    return combinedLength >= FEEDBACK_MIN_LENGTH;
  };

  const handleFeedbackChange = (e) => {
    const text = e.target.value;
    setFeedback(text);
    setCharCount(text.length);
    if (text.length >= 50) {
      updateSBIIndicators(text);
    }
  };

  const proceedToSanitization = async (feedbackText) => {
    setShowQualityModal(false);
    setLoading(true);
    setError(null);

    const textToSanitize = feedbackText || (writeMode === 'guided' ? combineGuidedFeedback() : feedback);

    try {
      const { sanitized } = await sanitizeFeedback(textToSanitize);
      navigate('/preview', {
        state: {
          rawFeedback: textToSanitize,
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
    if (!senderName.trim() || !recipientName.trim() || !relationship.trim()) return;

    let feedbackText;

    if (writeMode === 'guided') {
      if (!isGuidedComplete()) return;
      feedbackText = combineGuidedFeedback();
    } else {
      if (!feedback.trim()) return;
      // Enforce minimum character count for freeform only
      if (charCount < FEEDBACK_MIN_LENGTH) {
        setError(`Please write at least ${FEEDBACK_MIN_LENGTH} characters (currently ${charCount})`);
        return;
      }
      feedbackText = feedback;
    }

    setError(null);
    setAnalyzingQuality(true);
    setShowQualityModal(true);

    try {
      const analysis = await analyzeFeedbackQuality(feedbackText);
      setQualityAnalysis(analysis);
    } catch (err) {
      // On error, proceed to sanitization anyway
      console.error('Quality analysis failed:', err);
      proceedToSanitization(feedbackText);
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

        <div className="how-it-works">
          <button
            type="button"
            className="how-it-works-toggle"
            onClick={() => setHowItWorksExpanded(!howItWorksExpanded)}
            aria-expanded={howItWorksExpanded}
          >
            <span>How does this work?</span>
            <svg
              className={`how-it-works-chevron ${howItWorksExpanded ? 'expanded' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className={`how-it-works-content ${howItWorksExpanded ? 'expanded' : ''}`}>
            <p className="how-it-works-heading">Honest feedback shouldn't feel risky.</p>
            <p>
              When you write here, your exact words stay private. Our AI reads your feedback
              and distills it into key themes — the <em>what</em> without the <em>how you said it</em>.
            </p>
            <p>
              Your recipient never sees your original text. They only see the themes, delivered
              in whatever format feels right to them — whether that's gentle, direct, or even a haiku.
            </p>
            <p>
              This way, you can be truly honest, and they can truly hear it.
            </p>
          </div>
        </div>

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

          {/* Writing Mode Toggle */}
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${writeMode === 'freeform' ? 'active' : ''}`}
              onClick={() => setWriteMode('freeform')}
              disabled={loading}
            >
              Write freely
            </button>
            <button
              type="button"
              className={`mode-btn ${writeMode === 'guided' ? 'active' : ''}`}
              onClick={() => setWriteMode('guided')}
              disabled={loading}
            >
              Guide me
            </button>
          </div>

          {writeMode === 'freeform' ? (
            <>
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

              {/* SBI-R Indicator - shows after 50 chars */}
              {charCount >= 50 && (
                <div className="sbi-indicator">
                  <span className="sbi-label">Feedback Elements:</span>
                  <div className="sbi-dots">
                    <span className={`sbi-dot ${sbiIndicators.situation ? 'active' : ''}`} title="Situation">S</span>
                    <span className={`sbi-dot ${sbiIndicators.behavior ? 'active' : ''}`} title="Behavior">B</span>
                    <span className={`sbi-dot ${sbiIndicators.impact ? 'active' : ''}`} title="Impact">I</span>
                    <span className={`sbi-dot ${sbiIndicators.request ? 'active' : ''}`} title="Request">R</span>
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
                      : !sbiIndicators.request
                      ? 'Consider adding a request for change'
                      : 'Great coverage!'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="guided-form">
              {/* Progress indicator */}
              <div className="guided-progress">
                {guidedSteps.map((step, index) => (
                  <div
                    key={step.key}
                    className={`guided-step-dot ${index === guidedStep ? 'active' : ''} ${guidedAnswers[step.key].trim() ? 'completed' : ''}`}
                    onClick={() => setGuidedStep(index)}
                  >
                    {index + 1}
                  </div>
                ))}
              </div>

              {/* Current step */}
              <div className="guided-step">
                <h3>{guidedSteps[guidedStep].title}</h3>
                <p className="guided-prompt">{guidedSteps[guidedStep].prompt}</p>
                <textarea
                  value={guidedAnswers[guidedSteps[guidedStep].key]}
                  onChange={(e) => handleGuidedAnswerChange(guidedSteps[guidedStep].key, e.target.value)}
                  placeholder={guidedSteps[guidedStep].example}
                  disabled={loading}
                />
                {/* Show combined length on last step */}
                {guidedStep === guidedSteps.length - 1 && (
                  <div className="char-counter">
                    <div className="char-counter-bar">
                      <div
                        className="char-counter-fill"
                        style={{ width: `${Math.min((combineGuidedFeedback().length / FEEDBACK_MIN_LENGTH) * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`char-counter-text ${combineGuidedFeedback().length >= FEEDBACK_MIN_LENGTH ? 'complete' : ''}`}>
                      {combineGuidedFeedback().length} / {FEEDBACK_MIN_LENGTH} minimum
                    </span>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="guided-nav">
                <button
                  type="button"
                  className="secondary"
                  onClick={handleGuidedBack}
                  disabled={guidedStep === 0 || loading}
                >
                  Back
                </button>
                {guidedStep < guidedSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleGuidedNext}
                    disabled={!guidedAnswers[guidedSteps[guidedStep].key].trim() || loading}
                  >
                    Next
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <button
            type="submit"
            disabled={
              loading ||
              !senderName.trim() ||
              !recipientName.trim() ||
              !relationship.trim() ||
              (writeMode === 'freeform' ? !feedback.trim() : !isGuidedComplete())
            }
          >
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
                  <button onClick={() => proceedToSanitization()}>
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
