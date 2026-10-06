const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL || '/api');

const nativeFetch = window.fetch.bind(window);
const apiBase = new URL(API_BASE_URL, window.location.origin);
const apiPath = apiBase.pathname.replace(/\/$/, '');

window.fetch = (resource, options = {}) => {
  const requestUrl = resource instanceof Request ? resource.url : String(resource);
  const absoluteUrl = new URL(requestUrl, window.location.origin);
  const targetsApi = absoluteUrl.origin === apiBase.origin
    && (absoluteUrl.pathname === apiPath || absoluteUrl.pathname.startsWith(`${apiPath}/`));

  if (!targetsApi) {
    return nativeFetch(resource, options);
  }

  const token = localStorage.getItem('onegymAuthToken');
  if (!token) {
    return nativeFetch(resource, options);
  }

  const headers = new Headers(resource instanceof Request ? resource.headers : undefined);
  new Headers(options.headers || {}).forEach((value, key) => headers.set(key, value));
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return nativeFetch(resource, { ...options, headers });
};
