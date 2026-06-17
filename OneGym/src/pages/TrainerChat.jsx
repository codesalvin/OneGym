import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { NavBar } from '../components/NavBar';
import './AiAssistant.css';
import './TrainerChat.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

async function readApiResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('onegymUser') || '{}');
  } catch {
    return {};
  }
}

function getInitials(value) {
  const name = value?.username || value?.email || value?.sender_name || 'Trainer';
  return name
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function formatMessageTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function TrainerChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useMemo(() => getStoredUser(), []);
  const isTrainerUser = user?.role === 'trainer';
  const targetRole = isTrainerUser ? 'member' : 'trainer';
  const targetLabel = isTrainerUser ? 'member' : 'trainer';
  const searchKey = isTrainerUser ? 'memberId' : 'trainerId';
  const [chatTargets, setChatTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState(searchParams.get(searchKey) || '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef(null);

  const selectedTarget = useMemo(() => {
    return chatTargets.find((target) => String(target.id) === String(selectedTargetId)) || null;
  }, [selectedTargetId, chatTargets]);

  async function loadChatTargets() {
    try {
      const response = await fetch(`${API_BASE_URL}/users/`);
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || `Unable to load ${targetLabel}s.`);
      }

      const targetUsers = Array.isArray(data) ? data.filter((item) => item.role === targetRole) : [];
      setChatTargets(targetUsers);

      if (!selectedTargetId && targetUsers.length) {
        setSelectedTargetId(String(targetUsers[0].id));
        setSearchParams({ [searchKey]: targetUsers[0].id });
      }
    } catch (error) {
      setIsError(true);
      setStatusMessage(error.message);
    }
  }

  async function loadMessages(targetId = selectedTargetId) {
    if (!user?.id || !targetId) {
      setMessages([]);
      return;
    }

    try {
      const memberId = isTrainerUser ? targetId : user.id;
      const trainerId = isTrainerUser ? user.id : targetId;
      const response = await fetch(`${API_BASE_URL}/users/${memberId}/trainer-messages/?trainer_id=${trainerId}`, {
        credentials: 'include',
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to load trainer chat.');
      }

      setMessages(Array.isArray(data) ? data : []);
      setIsError(false);
      setStatusMessage('');
    } catch (error) {
      setMessages([]);
      setIsError(true);
      setStatusMessage(error.message);
    }
  }

  useEffect(() => {
    loadChatTargets();
  }, []);

  useEffect(() => {
    if (selectedTargetId) {
      loadMessages(selectedTargetId);
    }
  }, [selectedTargetId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length]);

  function selectChatTarget(targetId) {
    setSelectedTargetId(String(targetId));
    setSearchParams({ [searchKey]: targetId });
  }

  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isSending) {
      return;
    }
    if (!selectedTargetId) {
      setIsError(true);
      setStatusMessage(`Choose a ${targetLabel} before sending a message.`);
      return;
    }

    setIsSending(true);
    setInput('');
    setIsError(false);
    setStatusMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/trainer-chat/messages/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: selectedTargetId,
          body: text,
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to send message.');
      }

      setMessages((current) => [...current, data]);
    } catch (error) {
      setIsError(true);
      setStatusMessage(error.message);
      setInput(text);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="ai-page trainer-chat-page">
        <aside className="ai-stats-panel trainer-list-panel">
          <p className="ai-kicker">Trainer Chat</p>
          <h1>Messages</h1>
          <p className="trainer-chat-copy">
            {isTrainerUser
              ? 'Reply to member questions about classes, recovery, technique, and session prep.'
              : 'Ask about classes, recovery, technique, or your next training move.'}
          </p>

          <div className="trainer-list">
            {chatTargets.length === 0 && (
              <p className="trainer-empty">No {targetLabel}s available yet.</p>
            )}

            {chatTargets.map((target) => (
              <button
                className={String(target.id) === String(selectedTargetId) ? 'active' : ''}
                key={target.id}
                onClick={() => selectChatTarget(target.id)}
                type="button"
              >
                <span>{getInitials(target)}</span>
                <div>
                  <strong>{target.username}</strong>
                  <small>{target.email}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="ai-chat-panel trainer-chat-panel">
          <div className="trainer-chat-header">
            <div>
              <p className="ai-kicker">Conversation</p>
              <h2>{selectedTarget ? selectedTarget.username : `Choose a ${targetLabel}`}</h2>
            </div>
            {selectedTarget && <span>{getInitials(selectedTarget)}</span>}
          </div>

          {statusMessage && (
            <p className={`trainer-status ${isError ? 'error' : ''}`}>{statusMessage}</p>
          )}

          <div className="ai-chat-scroll" ref={scrollRef}>
            {!selectedTarget && (
              <article className="ai-message assistant">
                <div className="ai-message-label">
                  <span className="material-symbols-outlined">fitness_center</span>
                  <strong>OneGym Trainer Chat</strong>
                </div>
                <div className="ai-bubble">
                  <h1>Select a {targetLabel}</h1>
                  <p>Choose a {targetLabel} from the left panel to start a saved conversation.</p>
                </div>
              </article>
            )}

            {selectedTarget && messages.length === 0 && (
              <article className="ai-message assistant">
                <div className="ai-message-label">
                  <span className="material-symbols-outlined">fitness_center</span>
                  <strong>{selectedTarget.username}</strong>
                </div>
                <div className="ai-bubble">
                  <h1>Start the conversation</h1>
                  <p>
                    {isTrainerUser
                      ? 'Send a reply, check in after class, or give a quick training note.'
                      : 'Send a question about your booked class, training form, or what to prepare before your next session.'}
                  </p>
                </div>
              </article>
            )}

            {messages.map((message) => {
              const isUserMessage = Number(message.sender_id) === Number(user.id);

              return (
                <article className={`ai-message ${isUserMessage ? 'user' : 'assistant'}`} key={message.id}>
                  {!isUserMessage && (
                    <div className="ai-message-label">
                      <span className="material-symbols-outlined">fitness_center</span>
                      <strong>{message.sender_name}</strong>
                    </div>
                  )}
                  <div className="ai-bubble">
                    <p>{message.body}</p>
                  </div>
                  {isUserMessage && <time>{formatMessageTime(message.created_at)}</time>}
                </article>
              );
            })}
          </div>

          <form className="ai-input-bar" onSubmit={sendMessage}>
            <input
              aria-label="Message trainer"
              disabled={isSending || !selectedTarget}
              onChange={(event) => setInput(event.target.value)}
              placeholder={selectedTarget ? `Message ${selectedTarget.username}...` : `Choose a ${targetLabel} first`}
              type="text"
              value={input}
            />
            <button aria-label="Send message" className="ai-send" disabled={isSending || !selectedTarget} type="submit">
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </form>
        </section>

      </main>
      <footer className="ai-footer">
        <span>OneGym trainer conversation</span>
        <div>
          <a href="/member-dashboard">Dashboard</a>
          <a href="/member-dashboard">Classes</a>
        </div>
      </footer>
    </>
  );
}
