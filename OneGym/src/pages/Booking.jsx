import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { NavBar } from '../components/NavBar';
import { Footer } from '../components/Footer';
import './Booking.css';

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

function formatTimeRange(value) {
  const start = new Date(value);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatClassDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function getDayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function BookingPage() {
  const [classes, setClasses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeDay, setActiveDay] = useState('');
  const [activeView, setActiveView] = useState('schedule');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);

  const user = useMemo(() => {
    const storedUser = localStorage.getItem('onegymUser');
    return storedUser ? JSON.parse(storedUser) : null;
  }, []);

  async function loadClasses() {
    const response = await fetch(`${API_BASE_URL}/classes/`);
    if (!response.ok) {
      throw new Error('Schedule API is unavailable.');
    }
    const data = await response.json();
    setClasses(data);

    if (!activeDay && data.length) {
      setActiveDay(getDayKey(data[0].schedule_time));
    }
  }

  async function loadBookings() {
    if (!user?.id) {
      setBookings([]);
      setBookingsLoaded(true);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/users/${user.id}/bookings/`);
    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.detail || 'Unable to load your bookings.');
    }

    setBookings(data);
    setBookingsLoaded(true);
  }

  useEffect(() => {
    loadClasses().catch((error) => {
      setIsError(true);
      setMessage(error.message || 'Unable to load class schedule. Make sure Django is running.');
    });
  }, []);

  const availableDays = useMemo(() => {
    return [...new Set(classes.map((item) => getDayKey(item.schedule_time)))];
  }, [classes]);

  const bookedClassIds = useMemo(() => {
    return new Set(bookings.map((booking) => booking.class_id));
  }, [bookings]);

  const visibleClasses = classes.filter((item) => getDayKey(item.schedule_time) === activeDay);

  function showSchedule() {
    setActiveView('schedule');
  }

  function showBookings() {
    setActiveView('bookings');

    if (!bookingsLoaded) {
      loadBookings().catch((error) => {
        setIsError(true);
        setMessage(error.message);
      });
    }
  }

  function askToBook(item) {
    if (!user?.id) {
      setIsError(true);
      setMessage('Please sign in before booking a class.');
      return;
    }

    setPendingAction({
      type: 'book',
      item,
      title: 'Confirm booking',
      body: `${item.title} on ${formatClassDate(item.schedule_time)} at ${formatTimeRange(item.schedule_time)}.`,
    });
  }

  function askToCancel(item) {
    setPendingAction({
      type: 'cancel',
      item,
      title: 'Cancel booking',
      body: `${item.title} on ${formatClassDate(item.schedule_time)} at ${formatTimeRange(item.schedule_time)}.`,
    });
  }

  async function confirmAction() {
    if (!pendingAction || !user?.id) {
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setIsError(false);

    try {
      const endpoint =
        pendingAction.type === 'book'
          ? `${API_BASE_URL}/classes/${pendingAction.item.id}/book/`
          : `${API_BASE_URL}/bookings/${pendingAction.item.id}/cancel/?user_id=${user.id}`;
      const response = await fetch(endpoint, {
        method: pendingAction.type === 'book' ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to update this booking.');
      }

      await loadClasses();
      await loadBookings();
      setActiveView(pendingAction.type === 'book' ? 'bookings' : activeView);
      setPendingAction(null);
      setNotice({
        title: pendingAction.type === 'book' ? 'Booking confirmed' : 'Booking cancelled',
        body: data.detail || 'Your booking has been updated.',
      });
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
      setPendingAction(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="booking-page">
        <section className="booking-schedule">
          <Link className="booking-back" to="/member-dashboard" aria-label="Back to dashboard">
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            Dashboard
          </Link>

          <div className="booking-header">
            <div>
              <p className="booking-eyebrow">Class Booking</p>
              <h1>Today's Sanctuary Schedule</h1>
              <p>Reserve your place in our high-ceilinged studios. Slots update as members book.</p>
            </div>
            <div className="booking-view-tabs" aria-label="Booking views">
              <button className={activeView === 'schedule' ? 'active' : ''} onClick={showSchedule} type="button">
                Schedule
              </button>
              <button className={activeView === 'bookings' ? 'active' : ''} onClick={showBookings} type="button">
                My Bookings
              </button>
            </div>
          </div>

          {message && (
            <p className={`booking-message ${isError ? 'error' : 'success'}`}>{message}</p>
          )}

          {activeView === 'schedule' ? (
            <>
              <div className="booking-tabs">
                {availableDays.map((day) => (
                  <button
                    className={day === activeDay ? 'active' : ''}
                    key={day}
                    onClick={() => setActiveDay(day)}
                    type="button"
                  >
                    {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(day))}
                  </button>
                ))}
              </div>

              <div className="booking-list">
                {visibleClasses.map((item) => {
                  const isFull = item.available_slots <= 0;
                  const isBooked = bookedClassIds.has(item.id);
                  return (
                    <article className={`booking-row ${isFull ? 'is-full' : ''}`} key={item.id}>
                      <div className="booking-time">{formatTimeRange(item.schedule_time)}</div>
                      <div className="booking-class">
                        <h2>{item.title}</h2>
                        <p>{item.room}</p>
                      </div>
                      <div className="booking-instructor">Guided by {item.instructor_name}</div>
                      <div className="booking-slots">
                        <strong>{item.available_slots}</strong>
                        <span>/ {item.slots} slots</span>
                      </div>
                      <button disabled={isFull || isBooked} onClick={() => askToBook(item)} type="button">
                        {isBooked ? 'Booked' : isFull ? 'Full' : 'Book'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="booking-list">
              {!user?.id ? (
                <div className="booking-empty">
                  <h2>Sign in to view bookings</h2>
                  <p>Your reserved classes will appear here after you log in.</p>
                </div>
              ) : bookings.length ? (
                bookings.map((item) => (
                  <article className="booking-row" key={item.id}>
                    <div className="booking-time">
                      {formatClassDate(item.schedule_time)}
                      <span>{formatTimeRange(item.schedule_time)}</span>
                    </div>
                    <div className="booking-class">
                      <h2>{item.title}</h2>
                      <p>{item.room}</p>
                    </div>
                    <div className="booking-instructor">Guided by {item.instructor_name}</div>
                    <div className="booking-slots">
                      <strong>{item.available_slots}</strong>
                      <span>/ {item.slots} slots</span>
                    </div>
                    <button className="cancel-booking-button" onClick={() => askToCancel(item)} type="button">
                      Cancel
                    </button>
                  </article>
                ))
              ) : (
                <div className="booking-empty">
                  <h2>No bookings yet</h2>
                  <p>Book a class from the schedule and it will appear here.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {(pendingAction || notice) && (
        <div className="booking-modal-backdrop" role="presentation">
          <div className="booking-modal" role="dialog" aria-modal="true">
            <p className="booking-eyebrow">{pendingAction ? 'Confirmation' : 'Status'}</p>
            <h2>{pendingAction?.title || notice.title}</h2>
            <p>{pendingAction?.body || notice.body}</p>
            <div className="booking-modal-actions">
              {pendingAction ? (
                <>
                  <button className="ghost" disabled={isSubmitting} onClick={() => setPendingAction(null)} type="button">
                    Back
                  </button>
                  <button disabled={isSubmitting} onClick={confirmAction} type="button">
                    {isSubmitting ? 'Saving' : pendingAction.type === 'book' ? 'Confirm Booking' : 'Cancel Booking'}
                  </button>
                </>
              ) : (
                <button onClick={() => setNotice(null)} type="button">
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
