import { API_URL } from './config';

// Thin wrapper around fetch that throws a readable Error on non-2xx
// responses and always parses JSON, so pages can just await + catch.
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (err) {
    throw new Error(`Could not reach the server at ${API_URL}. Is it running?`);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body, that's fine for some responses
  }

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const productEventsUrl = `${API_URL}/api/product-events`;
