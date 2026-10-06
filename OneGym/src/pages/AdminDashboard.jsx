import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './AdminDashboard.css';
import logoImage from '../../images/logo.png';

const API = import.meta.env.DEV ? '/api/admin' : `${import.meta.env.VITE_API_BASE_URL || '/api'}/admin`;
const NAV_ITEMS = [
  ['overview', 'Dashboard', 'grid_view'],
  ['users', 'Users', 'group'],
  ['trainers', 'Trainer Applications', 'verified_user'],
  ['classes', 'Classes', 'calendar_month'],
  ['training', 'Training', 'fitness_center'],
  ['plans', 'Plans', 'sell'],
  ['subscriptions', 'Subscriptions', 'autorenew'],
  ['payments', 'Payments', 'payments'],
  ['notifications', 'Notifications', 'notifications'],
  ['reviews', 'Reviews', 'star'],
  ['audit', 'Audit Logs', 'history'],
];
const ROLES = ['member', 'pro', 'studio', 'trainer', 'admin', 'owner'];

function storedUser() {
  try { return JSON.parse(localStorage.getItem('onegymUser') || '{}'); } catch { return {}; }
}

function money(cents, currency = 'MYR') {
  const amount = Number(cents || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeCurrency = /^[A-Za-z]{3}$/.test(String(currency || '')) ? String(currency).toUpperCase() : 'MYR';
  try {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: safeCurrency }).format(safeAmount / 100);
  } catch {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(safeAmount / 100);
  }
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function displayText(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return String(value);
}

function labelText(value, fallback = 'Updated') {
  return displayText(value, fallback).replaceAll('_', ' ');
}

class AdminContentBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Admin dashboard section failed to render.', error);
  }

  render() {
    if (this.state.failed) {
      return <div className="admin-render-error"><span className="material-symbols-outlined">error</span><div><strong>This section could not be displayed.</strong><p>The rest of the admin portal is still available.</p></div><button type="button" onClick={() => this.setState({ failed: false })}>Try again</button></div>;
    }
    return this.props.children;
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    ...options,
  });
  if (response.status === 401) {
    localStorage.removeItem('onegymUser');
    localStorage.removeItem('onegymAuthToken');
    window.location.replace('/signin?reason=session-expired');
    throw new Error('Session expired.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || 'Request failed.');
  return data;
}

function Empty({ children = 'No records found.' }) {
  return <div className="admin-empty"><span className="material-symbols-outlined">inbox</span><p>{children}</p></div>;
}

function Status({ value }) {
  const normalized = String(value || 'unknown').toLowerCase();
  return <span className={`admin-status status-${normalized}`}>{normalized.replace('_', ' ')}</span>;
}

export function AdminDashboardPage() {
  const admin = useMemo(storedUser, []);
  const [active, setActive] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return NAV_ITEMS.some(([id]) => id === tab) ? tab : 'overview';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overview, setOverview] = useState(null);
  const [records, setRecords] = useState([]);
  const [secondary, setSecondary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [planForm, setPlanForm] = useState({ code: '', name: '', price_cents: '', currency: 'MYR' });
  const [notificationForm, setNotificationForm] = useState({ audience: 'all', title: '', body: '' });
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true); setError('');
    try {
      let nextRecords = [];
      let nextSecondary = [];
      let nextOverview = null;

      if (active === 'overview') nextOverview = await api('/overview/');
      if (active === 'users') nextRecords = await api(`/users/?search=${encodeURIComponent(search)}&role=${roleFilter}`);
      if (active === 'trainers') nextRecords = await api('/trainer-applications/');
      if (active === 'classes') nextRecords = await api('/classes/');
      if (active === 'training') {
        const data = await api('/training/');
        nextRecords = data.programs || [];
        nextSecondary = data.sessions || [];
      }
      if (active === 'plans') nextRecords = await api('/plans/');
      if (active === 'subscriptions') nextRecords = await api('/subscriptions/');
      if (active === 'payments') nextRecords = await api('/payments/');
      if (active === 'notifications') nextRecords = await api('/notifications/');
      if (active === 'reviews') nextRecords = await api('/reviews/');
      if (active === 'audit') nextRecords = await api('/audit-logs/');

      if (requestId !== loadRequestRef.current) return;
      if (active === 'overview') setOverview(nextOverview);
      else setRecords(Array.isArray(nextRecords) ? nextRecords : []);
      setSecondary(Array.isArray(nextSecondary) ? nextSecondary : []);
    } catch (err) {
      if (requestId === loadRequestRef.current) setError(err.message);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [active, roleFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function act(action, success) {
    setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); }
    catch (err) { setError(err.message); }
  }

  function changeTab(tab) { setActive(tab); setMobileOpen(false); setNotice(''); setError(''); }

  const counts = overview?.counts || {};
  const cards = [
    ['Active Users', counts.users, 'group', 'violet'], ['Trainers', counts.trainers, 'fitness_center', 'blue'],
    ['Pending Trainers', counts.pending_trainers, 'verified_user', 'amber'], ['Upcoming Classes', counts.upcoming_classes, 'calendar_month', 'green'],
    ['Active Memberships', counts.active_subscriptions, 'autorenew', 'pink'], ['Revenue', money(counts.revenue_cents), 'payments', 'cyan'],
  ];

  return <div className="admin-shell">
    <button className="admin-mobile-menu" onClick={() => setMobileOpen(true)}><span className="material-symbols-outlined">menu</span></button>
    {mobileOpen && <button className="admin-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="admin-brand"><img src={logoImage} alt="OneGym" /><div><strong>OneGym</strong><small>Administration</small></div></div>
      <nav>{NAV_ITEMS.map(([id, label, icon]) => <button className={active === id ? 'active' : ''} key={id} onClick={() => changeTab(id)}>
        <span className="material-symbols-outlined">{icon}</span><span>{label}</span>
        {id === 'trainers' && Number(counts.pending_trainers) > 0 && <b>{counts.pending_trainers}</b>}
      </button>)}</nav>
      <div className="admin-sidebar-user"><div>{(admin.username || 'A')[0].toUpperCase()}</div><span><strong>{admin.username || 'Administrator'}</strong><small>{admin.email}</small></span></div>
      <button className="admin-signout" onClick={async () => { await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/signout/`, { method: 'POST', credentials: 'include' }); localStorage.removeItem('onegymUser'); localStorage.removeItem('onegymAuthToken'); location.href='/signin'; }}><span className="material-symbols-outlined">logout</span>Sign out</button>
    </aside>

    <main className="admin-main">
      <header><div><p>OneGym control center</p><h1>{NAV_ITEMS.find(item => item[0] === active)?.[1]}</h1></div><div className="admin-header-actions"><button onClick={load}><span className="material-symbols-outlined">refresh</span></button><a href="/">View website</a></div></header>
      {notice && <div className="admin-alert success">{notice}</div>}
      {error && <div className="admin-alert error">{error}</div>}
      <AdminContentBoundary key={active}>
      {loading ? <div className="admin-loader"><span /><p>Loading administration data…</p></div> : <>
        {active === 'overview' && <section>
          <div className="admin-card-grid">{cards.map(([label, value, icon, color]) => <article className={`admin-stat ${color}`} key={label}><span className="material-symbols-outlined">{icon}</span><div><small>{label}</small><strong>{value ?? 0}</strong></div></article>)}</div>
          <div className="admin-panel"><div className="admin-panel-title"><div><p>Latest changes</p><h2>Recent administrative activity</h2></div><button onClick={() => changeTab('audit')}>View all</button></div>
            <div className="admin-activity">{overview?.recent_activity?.length ? overview.recent_activity.map(item => <div key={item.id}><span className="material-symbols-outlined">history</span><p><strong>{displayText(item.actor_name, 'Administrator')}</strong> {labelText(item.action, 'updated')} <b>{displayText(item.entity_type, 'record')}</b></p><time>{dateTime(item.created_at)}</time></div>) : <Empty />}</div>
          </div>
        </section>}

        {active === 'users' && <section><div className="admin-toolbar"><div className="admin-search"><span className="material-symbols-outlined">search</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users" /></div><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="">All roles</option>{ROLES.map(role=><option key={role}>{role}</option>)}</select></div>
          <div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Status</th><th>Joined</th><th>Account</th></tr></thead><tbody>{records.map(user=><tr key={user.id}><td><div className="admin-person"><span>{String(user.username || 'U')[0].toUpperCase()}</span><div><strong>{user.username || 'Unknown user'}</strong><small>{user.email || '—'}</small></div></div></td><td><select value={user.role || 'member'} onChange={e=>act(()=>api(`/users/${user.id}/`,{method:'PATCH',body:JSON.stringify({role:e.target.value})}),'Role updated.')}>{ROLES.map(role=><option key={role}>{role}</option>)}</select></td><td>{user.plan_name || 'Free'}<small className="cell-sub"><Status value={user.subscription_status}/></small></td><td><Status value={user.is_active ? 'active' : 'inactive'}/></td><td>{dateTime(user.created_at)}</td><td><button className="admin-action" disabled={user.id===admin.id} onClick={()=>act(()=>api(`/users/${user.id}/`,{method:'PATCH',body:JSON.stringify({is_active:!user.is_active})}),user.is_active?'User deactivated.':'User activated.')}>{user.is_active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table>{!records.length&&<Empty/>}</div>
        </section>}

        {active === 'trainers' && <section className="admin-application-grid">{records.length ? records.map(item=>{ const trainerName=displayText(item.full_name, 'Trainer applicant'); return <article className="admin-application" key={item.id}><div className="admin-application-head"><div className="admin-person"><span>{trainerName[0].toUpperCase()}</span><div><strong>{trainerName}</strong><small>{displayText(item.email)}</small></div></div><Status value={item.status}/></div><dl><div><dt>Specialties</dt><dd>{displayText(item.specialties)}</dd></div><div><dt>Experience</dt><dd>{displayText(item.experience_years, '0')} years</dd></div><div><dt>Phone</dt><dd>{displayText(item.phone)}</dd></div></dl>{item.bio&&<p className="admin-application-bio">{displayText(item.bio)}</p>}<div className="admin-card-actions">{item.certification_file_url&&<a href={item.certification_file_url} target="_blank" rel="noreferrer">View certificate</a>}{item.status==='pending'&&<><button className="approve" onClick={()=>act(()=>api(`/trainer-applications/${item.id}/`,{method:'PATCH',body:JSON.stringify({status:'approved'})}),'Trainer approved.')}>Approve</button><button className="reject" onClick={()=>act(()=>api(`/trainer-applications/${item.id}/`,{method:'PATCH',body:JSON.stringify({status:'rejected'})}),'Application rejected.')}>Reject</button></>}</div></article>}) : <Empty>No trainer applications.</Empty>}</section>}

        {active === 'classes' && <DataTable headers={['Class','Trainer','Schedule','Bookings','Status','Actions']} empty="No classes created.">{records.map(item=><tr key={item.id}><td><strong>{item.title}</strong><small className="cell-sub">{item.room}</small></td><td>{item.trainer_name||'Unassigned'}</td><td>{dateTime(item.start_time)}<small className="cell-sub">{item.duration_minutes} minutes</small></td><td>{item.booking_count} / {item.capacity}</td><td><Status value={item.status}/></td><td><div className="table-actions"><button onClick={()=>act(()=>api(`/classes/${item.id}/`,{method:'PATCH',body:JSON.stringify({status:item.status==='cancelled'?'scheduled':'cancelled'})}),'Class status updated.')}>{item.status==='cancelled'?'Restore':'Cancel'}</button><button className="danger" onClick={()=>confirm('Delete this class?')&&act(()=>api(`/classes/${item.id}/`,{method:'DELETE'}),'Class deleted.')}>Delete</button></div></td></tr>)}</DataTable>}

        {active === 'training' && <section className="admin-two-column"><div className="admin-panel"><div className="admin-panel-title"><h2>Training programs</h2></div>{records.length?records.map(item=><div className="admin-list-row" key={item.id}><div><strong>{item.title}</strong><small>{item.trainer_name} → {item.client_name}</small></div><span>{item.exercise_count} exercises</span><Status value={item.status}/></div>):<Empty/>}</div><div className="admin-panel"><div className="admin-panel-title"><h2>Training sessions</h2></div>{secondary.length?secondary.map(item=><div className="admin-list-row" key={item.id}><div><strong>{item.client_name}</strong><small>{item.trainer_name} · {dateTime(item.scheduled_at)}</small></div><span>{item.duration_minutes} min</span><Status value={item.status}/></div>):<Empty/>}</div></section>}

        {active === 'plans' && <section><form className="admin-inline-form" onSubmit={e=>{e.preventDefault();act(()=>api('/plans/',{method:'POST',body:JSON.stringify({...planForm,price_cents:Number(planForm.price_cents)})}),'Plan created.');setPlanForm({code:'',name:'',price_cents:'',currency:'MYR'});}}><input required placeholder="Code" value={planForm.code} onChange={e=>setPlanForm({...planForm,code:e.target.value})}/><input required placeholder="Plan name" value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})}/><input required min="0" type="number" placeholder="Price in cents" value={planForm.price_cents} onChange={e=>setPlanForm({...planForm,price_cents:e.target.value})}/><input maxLength="3" value={planForm.currency} onChange={e=>setPlanForm({...planForm,currency:e.target.value})}/><button>Create plan</button></form><div className="admin-plan-grid">{records.map(plan=><article key={plan.id}><div><Status value={plan.is_active?'active':'inactive'}/><h2>{plan.name}</h2><p>{plan.code}</p></div><strong>{money(plan.price_cents,plan.currency)}</strong><small>{plan.subscriber_count} active subscribers</small><button onClick={()=>act(()=>api(`/plans/${plan.id}/`,{method:'PATCH',body:JSON.stringify({is_active:!plan.is_active})}),'Plan updated.')}>{plan.is_active?'Deactivate':'Activate'}</button></article>)}</div></section>}

        {active === 'subscriptions' && <DataTable headers={['Member','Plan','Status','Period','Created']} empty="No subscriptions.">{records.map(item=><tr key={item.id}><td><strong>{item.username}</strong><small className="cell-sub">{item.email}</small></td><td>{item.plan_name}</td><td><Status value={item.status}/></td><td>{dateTime(item.current_period_start)}<small className="cell-sub">to {dateTime(item.current_period_end)}</small></td><td>{dateTime(item.created_at)}</td></tr>)}</DataTable>}

        {active === 'payments' && <DataTable headers={['Member','Payment ID','Amount','Status','Paid','Created']} empty="No payments recorded yet.">{records.map(item=><tr key={item.id}><td><strong>{item.username}</strong><small className="cell-sub">{item.email}</small></td><td className="mono">{item.stripe_payment_id}</td><td>{money(item.amount_cents,item.currency)}</td><td><Status value={item.status}/></td><td>{dateTime(item.paid_at)}</td><td>{dateTime(item.created_at)}</td></tr>)}</DataTable>}

        {active === 'notifications' && <section className="admin-two-column notification-layout"><form className="admin-panel admin-form" onSubmit={e=>{e.preventDefault();act(()=>api('/notifications/',{method:'POST',body:JSON.stringify(notificationForm)}),'Notification sent.');setNotificationForm({...notificationForm,title:'',body:''});}}><p>New announcement</p><h2>Notify your community</h2><label>Audience<select value={notificationForm.audience} onChange={e=>setNotificationForm({...notificationForm,audience:e.target.value})}><option value="all">Everyone</option>{ROLES.map(role=><option key={role}>{role}</option>)}</select></label><label>Title<input required value={notificationForm.title} onChange={e=>setNotificationForm({...notificationForm,title:e.target.value})}/></label><label>Message<textarea required rows="6" value={notificationForm.body} onChange={e=>setNotificationForm({...notificationForm,body:e.target.value})}/></label><button>Send notification</button></form><div className="admin-panel"><div className="admin-panel-title"><h2>Recently sent</h2></div>{records.length?records.slice(0,30).map(item=><div className="admin-notification-row" key={item.id}><span className="material-symbols-outlined">notifications</span><div><strong>{item.title}</strong><p>{item.body}</p><small>To {item.username} · {dateTime(item.created_at)}</small></div></div>):<Empty/>}</div></section>}

        {active === 'reviews' && <DataTable headers={['Type','Subject','Reviewer','Rating','Comment','Actions']} empty="No reviews submitted.">{records.map(item=>{ const rating=Math.max(0,Math.min(5,Number(item.rating)||0)); return <tr key={`${item.review_type}-${item.id}`}><td><Status value={item.review_type}/></td><td><strong>{displayText(item.subject)}</strong></td><td>{displayText(item.reviewer)}</td><td><span className="admin-stars">{'★'.repeat(rating)}</span> {rating}</td><td>{displayText(item.comment)}</td><td><button className="admin-action danger" onClick={()=>confirm('Remove this review?')&&act(()=>api(`/reviews/${item.review_type}/${item.id}/`,{method:'DELETE'}),'Review removed.')}>Remove</button></td></tr>})}</DataTable>}

        {active === 'audit' && <DataTable headers={['Administrator','Action','Entity','Details','Time']} empty="No administrative activity.">{records.map(item=><tr key={item.id}><td><strong>{displayText(item.actor_name, 'Administrator')}</strong></td><td>{labelText(item.action)}</td><td>{displayText(item.entity_type, 'record')} {item.entity_id&&`#${item.entity_id}`}</td><td className="admin-details">{displayText(item.details_json, '{}')}</td><td>{dateTime(item.created_at)}</td></tr>)}</DataTable>}
      </>}
      </AdminContentBoundary>
    </main>
  </div>;
}

function DataTable({ headers, children, empty }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="admin-table-wrap"><table><thead><tr>{headers.map(header=><th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table>{!hasRows&&<Empty>{empty}</Empty>}</div>;
}
