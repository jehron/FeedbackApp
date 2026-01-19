import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { getFeedbackMetadata, transformFeedback } from '../api';

const FORMAT_SUGGESTIONS = [
  'As a haiku',
  'As a limerick',
  'As bullet points',
  'As a motivational speech',
  'As a song',
  'Straight to the point'
];

function Receive() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [senderName, setSenderName] = useState(null);
  const [recipientName, setRecipientName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const checkFeedback = async () => {
      try {
        const metadata = await getFeedbackMetadata(id);
        if (!metadata) {
          setNotFound(true);
        } else {
          setSenderName(metadata.senderName);
          setRecipientName(metadata.recipientName);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkFeedback();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (format) => {
    const message = format || input;
    if (!message.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setSending(true);

    try {
      const { response, conversationId: newConvId } = await transformFeedback(
        id,
        message,
        conversationId
      );
      setConversationId(newConvId);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong: ${err.message}` }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading">Loading feedback</div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container">
        <div className="card">
          <h1>Feedback Not Found</h1>
          <p className="subtitle">
            This feedback link doesn't exist or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card chat-container">
        <h1>{recipientName ? `Hi ${recipientName}!` : 'You Have Feedback'}</h1>
        <p className="subtitle">
          {senderName || 'Someone'} has feedback for you. How would you like to receive it?
        </p>

        {messages.length === 0 && (
          <div className="format-suggestions">
            {FORMAT_SUGGESTIONS.map((format) => (
              <button
                key={format}
                className="format-chip"
                onClick={() => handleSend(format)}
                disabled={sending}
              >
                {format}
              </button>
            ))}
          </div>
        )}

        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          ))}
          {sending && (
            <div className="message assistant">
              <span className="loading">Thinking</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Request a format (e.g., 'as a poem', 'in Spanish')"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default Receive;
