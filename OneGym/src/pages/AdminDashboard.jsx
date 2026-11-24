import { Component, useCallback, useEffect, useRef, useState } from 'react';
import './AdminDashboard.css';
import logoImage from '../../images/logo.png';
import { downloadCsv, reportToCsv } from '../utils/reportCsv';

const API_BASE_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api');
const API = `${API_BASE_URL}/admin`;
const API_ROOT = API_BASE_URL.replace(/\/api\/?$/, '');
const NAV_ITEMS = [
  ['overview', 'Dashboard', 'grid_view'],
  ['users', 'Users', 'group'],
  ['trainers', 'Trainer Applications', 'verified_user'],
  ['classes', 'Classes', 'calendar_month'],
  ['plans', 'Plans', 'sell'],
  ['subscriptions', 'Subscriptions', 'autorenew'],
  ['payments', 'Payments', 'payments'],
  ['reports', 'Reports', 'analytics'],
  ['support', 'Support Requests', 'support_agent'],
  ['notifications', 'Notifications', 'notifications'],
  ['reviews', 'Reviews', 'star'],
  ['audit', 'Audit Logs', 'history'],
];
const ROLES = ['member', 'pro', 'studio', 'trainer', 'admin', 'owner'];

function storedUser() {
  try { return JSON.parse(localStorage.getItem('onegymUser') || '{}'); } catch { return {}; }
}

function resolveMediaUrl(value) {
  if (!value || /^(?:https?:|blob:|data:)/i.test(value)) return value || '';
  return `${API_ROOT}${value.startsWith('/') ? '' : '/'}${value}`;
}

async function readApiResponse(response) {
  const text = await response.text();
  if (!text) return null;
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw new Error(response.ok ? 'The server returned an unexpected response.' : `The server could not process the request (${response.status}).`);
  }
  try { return JSON.parse(text); } catch { throw new Error('The server returned an invalid response.'); }
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
  const data = response.status === 204 ? null : await readApiResponse(response);
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
  const [admin, setAdmin] = useState(storedUser);
  const [active, setActive] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return NAV_ITEMS.some(([id]) => id === tab) ? tab : 'overview';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overview, setOverview] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [topSearch, setTopSearch] = useState('');
  const [topSearchResults, setTopSearchResults] = useState([]);
  const [isTopSearchOpen, setIsTopSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('onegymAdminAutoRefresh') !== 'false');
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(() => resolveMediaUrl(storedUser().profile_photo_url || ''));
  const [profilePhotoMessage, setProfilePhotoMessage] = useState('');
  const [isProfilePhotoError, setIsProfilePhotoError] = useState(false);
  const [isSavingProfilePhoto, setIsSavingProfilePhoto] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [planForm, setPlanForm] = useState({ code: '', name: '', price_cents: '', currency: 'MYR' });
  const [notificationForm, setNotificationForm] = useState({ audience: 'all', title: '', body: '' });
  const loadRequestRef = useRef(0);
  const topSearchRef = useRef(null);
  const settingsRef = useRef(null);
  const profilePhotoInputRef = useRef(null);
  const adminProfilePhoto = profilePhotoPreview || resolveMediaUrl(admin.profile_photo_url || '');
  const adminInitial = String(admin.username || admin.email || 'A')[0].toUpperCase();

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true); setError('');
    setRecords(active === 'reports' ? {} : []);
    try {
      let nextRecords = [];
      let nextOverview = null;

      if (active === 'overview') nextOverview = await api('/overview/');
      if (active === 'users') nextRecords = await api(`/users/?search=${encodeURIComponent(search)}&role=${roleFilter}`);
      if (active === 'trainers') nextRecords = await api('/trainer-applications/');
      if (active === 'classes') nextRecords = await api('/classes/');
      if (active === 'plans') nextRecords = await api('/plans/');
      if (active === 'subscriptions') nextRecords = await api('/subscriptions/');
      if (active === 'payments') nextRecords = await api('/payments/');
      if (active === 'reports') nextRecords = await api('/reports/');
      if (active === 'support') nextRecords = await api('/support-tickets/');
      if (active === 'notifications') nextRecords = await api('/notifications/');
      if (active === 'reviews') nextRecords = await api('/reviews/');
      if (active === 'audit') nextRecords = await api('/audit-logs/');

      if (requestId !== loadRequestRef.current) return;
      if (active === 'overview') setOverview(nextOverview);
      else setRecords(active === 'reports' ? (nextRecords || {}) : (Array.isArray(nextRecords) ? nextRecords : []));
    } catch (err) {
      if (requestId === loadRequestRef.current) setError(err.message);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [active, roleFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    localStorage.setItem('onegymAdminAutoRefresh', String(autoRefresh));
    if (!autoRefresh) return undefined;
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, load]);

  useEffect(() => {
    const query = topSearch.trim();
    if (!query) {
      setTopSearchResults([]);
      return undefined;
    }

    let activeRequest = true;
    const timer = window.setTimeout(async () => {
      try {
        const results = await api(`/users/?search=${encodeURIComponent(query)}&role=`);
        if (activeRequest) setTopSearchResults(Array.isArray(results) ? results.slice(0, 6) : []);
      } catch {
        if (activeRequest) setTopSearchResults([]);
      }
    }, 220);

    return () => {
      activeRequest = false;
      window.clearTimeout(timer);
    };
  }, [topSearch]);

  useEffect(() => {
    function closePopovers(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'mousedown' && topSearchRef.current?.contains(event.target)) return;
      if (event.type === 'mousedown' && settingsRef.current?.contains(event.target)) return;
      setIsTopSearchOpen(false);
      setIsSettingsOpen(false);
    }

    document.addEventListener('mousedown', closePopovers);
    document.addEventListener('keydown', closePopovers);
    return () => {
      document.removeEventListener('mousedown', closePopovers);
      document.removeEventListener('keydown', closePopovers);
    };
  }, []);

  useEffect(() => () => {
    if (profilePhotoPreview.startsWith('blob:')) URL.revokeObjectURL(profilePhotoPreview);
  }, [profilePhotoPreview]);

  async function act(action, success) {
    setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); }
    catch (err) { setError(err.message); }
  }

  function changeTab(tab) { setActive(tab); setMobileOpen(false); setNotice(''); setError(''); }

  function openUserFromSearch(user) {
    const query = user.username || user.email || '';
    setTopSearch(query);
    setSearch(query);
    setRoleFilter('');
    setIsTopSearchOpen(false);
    changeTab('users');
  }

  function chooseProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setIsProfilePhotoError(true);
      setProfilePhotoMessage('Choose an image file.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setIsProfilePhotoError(true);
      setProfilePhotoMessage('Profile photo must be 4MB or smaller.');
      return;
    }
    if (profilePhotoPreview.startsWith('blob:')) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhotoFile(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
    setIsProfilePhotoError(false);
    setProfilePhotoMessage('Photo ready to save.');
  }

  async function saveProfilePhoto() {
    if (!admin.id || !profilePhotoFile || isSavingProfilePhoto) return;
    setIsSavingProfilePhoto(true);
    setIsProfilePhotoError(false);
    setProfilePhotoMessage('');
    try {
      const payload = new FormData();
      payload.append('profile_photo', profilePhotoFile);
      const response = await fetch(`${API_BASE_URL}/users/${admin.id}/`, {
        method: 'PATCH',
        credentials: 'include',
        body: payload,
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data?.detail || 'Unable to save profile photo.');
      const updatedAdmin = { ...admin, ...data, profile_photo_url: resolveMediaUrl(data.profile_photo_url || '') };
      setAdmin(updatedAdmin);
      setProfilePhotoFile(null);
      setProfilePhotoPreview(updatedAdmin.profile_photo_url);
      localStorage.setItem('onegymUser', JSON.stringify(updatedAdmin));
      window.dispatchEvent(new Event('onegym-auth-change'));
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
      setProfilePhotoMessage('Profile photo updated.');
    } catch (err) {
      setIsProfilePhotoError(true);
      setProfilePhotoMessage(err.message || 'Unable to save profile photo.');
    } finally {
      setIsSavingProfilePhoto(false);
    }
  }

  async function signOutAdmin() {
    try {
      await fetch(`${API_BASE_URL}/auth/signout/`, { method: 'POST', credentials: 'include' });
    } finally {
      localStorage.removeItem('onegymUser');
      localStorage.removeItem('onegymAuthToken');
      window.dispatchEvent(new Event('onegym-auth-change'));
      window.location.replace('/signin');
    }
  }

  const counts = overview?.counts || {};
  const cards = [
    ['Active Users', counts.users, 'group', 'violet'], ['Trainers', counts.trainers, 'fitness_center', 'blue'],
    ['Pending Trainers', counts.pending_trainers, 'verified_user', 'amber'], ['Upcoming Classes', counts.upcoming_classes, 'calendar_month', 'green'],
    ['Active Memberships', counts.active_subscriptions, 'autorenew', 'pink'], ['Revenue', money(counts.revenue_cents), 'payments', 'cyan'],
  ];
  const sectionDescriptions = {
    overview: `Welcome back, ${admin.username || 'Administrator'}. Here is your platform overview.`,
    users: 'Manage member access, account status, roles, and subscriptions.',
    trainers: 'Review trainer applications and approve qualified coaches.',
    classes: 'Monitor classes, bookings, schedules, and availability.',
    plans: 'Configure membership plans and pricing.',
    subscriptions: 'Track current memberships and renewal periods.',
    payments: 'Review payment activity and transaction status.',
    reports: 'Review operational totals and export a current CSV report.',
    support: 'Track and resolve requests submitted through the support page.',
    notifications: 'Send announcements and review recent communications.',
    reviews: 'Moderate ratings and community feedback.',
    audit: 'Review administrative actions across the platform.',
  };
  const activeLabel = NAV_ITEMS.find(item => item[0] === active)?.[1];

  return <div className="admin-shell">
    <button
      aria-controls="admin-sidebar"
      aria-expanded={mobileOpen}
      aria-label={mobileOpen ? 'Close administration menu' : 'Open administration menu'}
      className={`admin-mobile-menu ${mobileOpen ? 'open' : ''}`}
      onClick={() => setMobileOpen(current => !current)}
      type="button"
    ><span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span></button>
    {mobileOpen && <button className="admin-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`} id="admin-sidebar">
      <a className="admin-brand" href="/"><img src={logoImage} alt="OneGym" /><div><strong>OneGym</strong><small>Administration</small></div></a>
      <nav>{NAV_ITEMS.map(([id, label, icon]) => <button className={active === id ? 'active' : ''} key={id} onClick={() => changeTab(id)}>
        <span className="material-symbols-outlined">{icon}</span><span>{label}</span>
        {id === 'trainers' && Number(counts.pending_trainers) > 0 && <b>{counts.pending_trainers}</b>}
      </button>)}</nav>
    </aside>

    <main className="admin-main">
      <header className="admin-topbar">
        <div><h1>{active === 'overview' ? 'Admin Portal' : activeLabel}</h1><p>{sectionDescriptions[active]}</p></div>
        <div className="admin-header-actions">
          <div className="admin-top-search" ref={topSearchRef}>
            <label><span className="material-symbols-outlined">search</span><input aria-label="Search users" onChange={event => { setTopSearch(event.target.value); setIsTopSearchOpen(true); setIsSettingsOpen(false); }} onFocus={() => { setIsTopSearchOpen(true); setIsSettingsOpen(false); }} onKeyDown={event => { if (event.key === 'Enter' && topSearchResults[0]) { event.preventDefault(); openUserFromSearch(topSearchResults[0]); } }} placeholder="Search users..." type="search" value={topSearch} /></label>
            {isTopSearchOpen && topSearch.trim() && <div className="admin-top-search-results" role="listbox">{topSearchResults.length ? topSearchResults.map(user => <button key={user.id} onClick={() => openUserFromSearch(user)} role="option" type="button"><span>{String(user.username || user.email || 'U')[0].toUpperCase()}</span><span><strong>{user.username || 'Unknown user'}</strong><small>{user.email || user.role}</small></span></button>) : <p>No users match “{topSearch.trim()}”.</p>}</div>}
          </div>
          <button aria-label="Refresh administration data" onClick={load}><span className="material-symbols-outlined">refresh</span></button>
          <div className="admin-settings-menu" ref={settingsRef}>
            <button aria-expanded={isSettingsOpen} aria-label="Settings" className={`admin-settings-button ${isSettingsOpen ? 'active' : ''}`} onClick={() => { setIsSettingsOpen(current => !current); setIsTopSearchOpen(false); }} type="button"><span className="material-symbols-outlined">settings</span></button>
            {isSettingsOpen && <section aria-label="Admin settings" className="admin-settings-panel" role="dialog"><header><div><p>Preferences</p><h2>Admin settings</h2></div><button aria-label="Close settings" onClick={() => setIsSettingsOpen(false)} type="button"><span className="material-symbols-outlined">close</span></button></header><div className="admin-settings-account"><button aria-label="Choose admin profile photo" className="admin-profile-photo-button" onClick={() => profilePhotoInputRef.current?.click()} type="button">{adminProfilePhoto ? <img alt={admin.username || 'Administrator'} src={adminProfilePhoto} /> : <span>{adminInitial}</span>}<i className="material-symbols-outlined">photo_camera</i></button><input accept="image/jpeg,image/png,image/webp" className="admin-profile-photo-input" onChange={chooseProfilePhoto} ref={profilePhotoInputRef} type="file"/><div><strong>{admin.username || 'Administrator'}</strong><small>{admin.email || 'Admin account'}</small></div></div>{profilePhotoMessage && <p className={`admin-profile-photo-status ${isProfilePhotoError ? 'error' : ''}`}>{profilePhotoMessage}</p>}{profilePhotoFile && <button className="admin-profile-photo-save" disabled={isSavingProfilePhoto} onClick={saveProfilePhoto} type="button">{isSavingProfilePhoto ? 'Saving photo...' : 'Save profile photo'}</button>}<button aria-checked={autoRefresh} className="admin-setting-toggle" onClick={() => setAutoRefresh(current => !current)} role="switch" type="button"><span><strong>Auto-refresh data</strong><small>Refresh administration data every 30 seconds.</small></span><i className={autoRefresh ? 'active' : ''}><b /></i></button><button className="admin-settings-signout" onClick={signOutAdmin} type="button"><span className="material-symbols-outlined">logout</span>Sign out</button></section>}
          </div>
          <div className="admin-top-avatar">{adminProfilePhoto ? <img alt={admin.username || 'Administrator'} src={adminProfilePhoto} /> : adminInitial}</div>
        </div>
      </header>
      {notice && <div className="admin-alert success">{notice}</div>}
      {error && <div className="admin-alert error">{error}</div>}
      <AdminContentBoundary key={active}>
      {loading ? <div className="admin-loader"><span /><p>Loading administration data…</p></div> : <>
        {active === 'overview' && <section className="admin-overview">
          <article className="admin-hero-panel">
            <div className="admin-hero-copy">
              <p>Today's operations hub</p>
              <h2>Run OneGym with clarity</h2>
              <span>Manage members, trainers, classes, payments, and platform activity from one focused control center.</span>
              <div className="admin-hero-actions"><button onClick={() => changeTab('users')} type="button">Manage Users</button><button onClick={() => changeTab('trainers')} type="button">Review Trainers</button></div>
            </div>
            <div className="admin-hero-stats">
              {cards.slice(0, 4).map(([label, value, icon, color]) => <article className={`admin-stat ${color}`} key={label}><span className="material-symbols-outlined">{icon}</span><div><small>{label}</small><strong>{value ?? 0}</strong></div></article>)}
            </div>
          </article>
          <div className="admin-card-grid admin-card-grid-secondary">{cards.slice(4).map(([label, value, icon, color]) => <article className={`admin-stat ${color}`} key={label}><span className="material-symbols-outlined">{icon}</span><div><small>{label}</small><strong>{value ?? 0}</strong></div></article>)}</div>
          <div className="admin-panel"><div className="admin-panel-title"><div><p>Latest changes</p><h2>Recent administrative activity</h2></div><button onClick={() => changeTab('audit')}>View all</button></div>
            <div className="admin-activity">{overview?.recent_activity?.length ? overview.recent_activity.map(item => <div key={item.id}><span className="material-symbols-outlined">history</span><p><strong>{displayText(item.actor_name, 'Administrator')}</strong> {labelText(item.action, 'updated')} <b>{displayText(item.entity_type, 'record')}</b></p><time>{dateTime(item.created_at)}</time></div>) : <Empty />}</div>
          </div>
        </section>}

        {active === 'users' && <section><div className="admin-toolbar"><div className="admin-search"><span className="material-symbols-outlined">search</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users" /></div><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="">All roles</option>{ROLES.map(role=><option key={role}>{role}</option>)}</select></div>
          <div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Status</th><th>Joined</th><th>Account</th></tr></thead><tbody>{records.map(user=><tr key={user.id}><td><div className="admin-person"><span>{String(user.username || 'U')[0].toUpperCase()}</span><div><strong>{user.username || 'Unknown user'}</strong><small>{user.email || '—'}</small></div></div></td><td><select value={user.role || 'member'} onChange={e=>act(()=>api(`/users/${user.id}/`,{method:'PATCH',body:JSON.stringify({role:e.target.value})}),'Role updated.')}>{ROLES.map(role=><option key={role}>{role}</option>)}</select></td><td>{user.plan_name || 'Free'}<small className="cell-sub"><Status value={user.subscription_status}/></small></td><td><Status value={user.is_active ? 'active' : 'inactive'}/></td><td>{dateTime(user.created_at)}</td><td><button className="admin-action" disabled={user.id===admin.id} onClick={()=>act(()=>api(`/users/${user.id}/`,{method:'PATCH',body:JSON.stringify({is_active:!user.is_active})}),user.is_active?'User deactivated.':'User activated.')}>{user.is_active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table>{!records.length&&<Empty/>}</div>
        </section>}

        {active === 'trainers' && <section className="admin-application-grid">{records.length ? records.map(item=>{ const trainerName=displayText(item.full_name, 'Trainer applicant'); return <article className="admin-application" key={item.id}><div className="admin-application-head"><div className="admin-person"><span>{trainerName[0].toUpperCase()}</span><div><strong>{trainerName}</strong><small>{displayText(item.email)}</small></div></div><Status value={item.status}/></div><dl><div><dt>Specialties</dt><dd>{displayText(item.specialties)}</dd></div><div><dt>Experience</dt><dd>{displayText(item.experience_years, '0')} years</dd></div><div><dt>Phone</dt><dd>{displayText(item.phone)}</dd></div></dl>{item.bio&&<p className="admin-application-bio">{displayText(item.bio)}</p>}<div className="admin-card-actions">{item.certification_file_url&&<a href={item.certification_file_url} target="_blank" rel="noreferrer">View certificate</a>}{item.status==='pending'&&<><button className="approve" onClick={()=>act(()=>api(`/trainer-applications/${item.id}/`,{method:'PATCH',body:JSON.stringify({status:'approved'})}),'Trainer approved.')}>Approve</button><button className="reject" onClick={()=>act(()=>api(`/trainer-applications/${item.id}/`,{method:'PATCH',body:JSON.stringify({status:'rejected'})}),'Application rejected.')}>Reject</button></>}</div></article>}) : <Empty>No trainer applications.</Empty>}</section>}

        {active === 'classes' && <DataTable headers={['Class','Trainer','Schedule','Bookings','Status','Actions']} empty="No classes created.">{records.map(item=><tr key={item.id}><td><strong>{item.title}</strong><small className="cell-sub">{item.room}</small></td><td>{item.trainer_name||'Unassigned'}</td><td>{dateTime(item.start_time)}<small className="cell-sub">{item.duration_minutes} minutes</small></td><td>{item.booking_count} / {item.capacity}</td><td><Status value={item.status}/></td><td><div className="table-actions"><button onClick={()=>act(()=>api(`/classes/${item.id}/`,{method:'PATCH',body:JSON.stringify({status:item.status==='cancelled'?'scheduled':'cancelled'})}),'Class status updated.')}>{item.status==='cancelled'?'Restore':'Cancel'}</button><button className="danger" onClick={()=>confirm('Delete this class?')&&act(()=>api(`/classes/${item.id}/`,{method:'DELETE'}),'Class deleted.')}>Delete</button></div></td></tr>)}</DataTable>}


        {active === 'plans' && <section><form className="admin-inline-form" onSubmit={e=>{e.preventDefault();act(()=>api('/plans/',{method:'POST',body:JSON.stringify({...planForm,price_cents:Number(planForm.price_cents)})}),'Plan created.');setPlanForm({code:'',name:'',price_cents:'',currency:'MYR'});}}><input required placeholder="Code" value={planForm.code} onChange={e=>setPlanForm({...planForm,code:e.target.value})}/><input required placeholder="Plan name" value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})}/><input required min="0" type="number" placeholder="Price in cents" value={planForm.price_cents} onChange={e=>setPlanForm({...planForm,price_cents:e.target.value})}/><input maxLength="3" value={planForm.currency} onChange={e=>setPlanForm({...planForm,currency:e.target.value})}/><button>Create plan</button></form><div className="admin-plan-grid">{records.map(plan=><article key={plan.id}><div><Status value={plan.is_active?'active':'inactive'}/><h2>{plan.name}</h2><p>{plan.code}</p></div><strong>{money(plan.price_cents,plan.currency)}</strong><small>{plan.subscriber_count} active subscribers</small><button onClick={()=>act(()=>api(`/plans/${plan.id}/`,{method:'PATCH',body:JSON.stringify({is_active:!plan.is_active})}),'Plan updated.')}>{plan.is_active?'Deactivate':'Activate'}</button></article>)}</div></section>}

        {active === 'subscriptions' && <DataTable headers={['Member','Plan','Status','Period','Created']} empty="No subscriptions.">{records.map(item=><tr key={item.id}><td><strong>{item.username}</strong><small className="cell-sub">{item.email}</small></td><td>{item.plan_name}</td><td><Status value={item.status}/></td><td>{dateTime(item.current_period_start)}<small className="cell-sub">to {dateTime(item.current_period_end)}</small></td><td>{dateTime(item.created_at)}</td></tr>)}</DataTable>}

        {active === 'payments' && <DataTable headers={['Member','Payment ID','Amount','Status','Paid','Created']} empty="No payments recorded yet.">{records.map(item=><tr key={item.id}><td><strong>{item.username}</strong><small className="cell-sub">{item.email}</small></td><td className="mono">{item.stripe_payment_id}</td><td>{money(item.amount_cents,item.currency)}</td><td><Status value={item.status}/></td><td>{dateTime(item.paid_at)}</td><td>{dateTime(item.created_at)}</td></tr>)}</DataTable>}

        {active === 'reports' && <section className="admin-report-section"><div className="admin-report-actions"><div><p>Generated {dateTime(records.generated_at)}</p><h2>Operational report</h2></div><button onClick={()=>downloadCsv('onegym-operational-report.csv',reportToCsv(records))} type="button"><span className="material-symbols-outlined">download</span> Export CSV</button></div><div className="admin-metric-grid">{Object.entries(records.summary||{}).map(([key,value])=><article key={key}><small>{labelText(key)}</small><strong>{key==='revenue_cents'?money(value):Number(value||0).toLocaleString()}</strong></article>)}</div><div className="admin-report-tables"><DataTable headers={['User role','Users']} empty="No user data.">{(records.users_by_role||[]).map(item=><tr key={item.label}><td>{labelText(item.label)}</td><td>{item.value}</td></tr>)}</DataTable><DataTable headers={['Membership status','Subscriptions']} empty="No subscription data.">{(records.subscriptions_by_status||[]).map(item=><tr key={item.label}><td><Status value={item.label}/></td><td>{item.value}</td></tr>)}</DataTable><DataTable headers={['Payment status','Payments','Amount']} empty="No payment data.">{(records.payments_by_status||[]).map(item=><tr key={item.label}><td><Status value={item.label}/></td><td>{item.value}</td><td>{money(item.amount_cents)}</td></tr>)}</DataTable></div></section>}

        {active === 'support' && <DataTable headers={['Reference','Requester','Subject','Message','Status','Submitted']} empty="No support requests.">{records.map(item=><tr key={item.id}><td>#{item.id}</td><td><strong>{item.name}</strong><small className="cell-sub">{item.email}</small></td><td>{item.subject}</td><td className="admin-details">{item.message}</td><td><select value={item.status} onChange={event=>act(()=>api(`/support-tickets/${item.id}/`,{method:'PATCH',body:JSON.stringify({status:event.target.value})}),'Support request updated.')}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></td><td>{dateTime(item.created_at)}</td></tr>)}</DataTable>}

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
