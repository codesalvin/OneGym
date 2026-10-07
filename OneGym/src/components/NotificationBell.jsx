import { useCallback, useEffect, useRef, useState } from 'react';
import './NotificationBell.css';

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      detail: response.ok
        ? 'The server returned an invalid response.'
        : `Notification service returned ${response.status}.`,
    };
  }
}

function formatNotificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat('en-US', sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(date);
}

function notificationIcon(type) {
  if (type === 'message') return 'chat_bubble';
  if (type === 'admin_announcement') return 'campaign';
  return 'notifications';
}

export function NotificationBell({ apiBaseUrl, onOpenMessage }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      const response = await fetch(`${apiBaseUrl}/notifications/`, { credentials: 'include' });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data?.detail || 'Unable to load notifications.');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (loadError) {
      if (!silent) setError(loadError.message);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(() => loadNotifications({ silent: true }), 15000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const unreadCount = items.filter((item) => !item.read_at).length;

  async function markRead(item) {
    if (!item.read_at) {
      const response = await fetch(`${apiBaseUrl}/notifications/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: item.id }),
      });
      if (response.ok) {
        const readAt = new Date().toISOString();
        setItems((current) => current.map((entry) => (
          entry.id === item.id ? { ...entry, read_at: readAt } : entry
        )));
      }
    }

    if (item.notification_type === 'message' && onOpenMessage) {
      setIsOpen(false);
      onOpenMessage();
    }
  }

  async function markAllRead() {
    const response = await fetch(`${apiBaseUrl}/notifications/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (response.ok) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
    }
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-label="Notifications"
        className="notification-bell-button"
        onClick={() => {
          setIsOpen((current) => !current);
          if (!isOpen) loadNotifications();
        }}
        type="button"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && <strong>{unreadCount > 99 ? '99+' : unreadCount}</strong>}
      </button>

      {isOpen && (
        <section className="notification-panel" aria-label="Notification list">
          <header>
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p>
            </div>
            {unreadCount > 0 && <button onClick={markAllRead} type="button">Mark all read</button>}
          </header>
          <div className="notification-list">
            {error && <p className="notification-error">{error}</p>}
            {!error && !items.length && (
              <div className="notification-empty">
                <span className="material-symbols-outlined">notifications_off</span>
                <strong>No notifications yet</strong>
                <small>Messages and announcements will appear here.</small>
              </div>
            )}
            {items.map((item) => (
              <button
                className={`notification-item ${item.read_at ? '' : 'unread'}`}
                key={item.id}
                onClick={() => markRead(item)}
                type="button"
              >
                <span className="notification-item-icon material-symbols-outlined">{notificationIcon(item.notification_type)}</span>
                <span className="notification-item-copy">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  <small>{formatNotificationTime(item.created_at)}</small>
                </span>
                {!item.read_at && <i aria-label="Unread" />}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
