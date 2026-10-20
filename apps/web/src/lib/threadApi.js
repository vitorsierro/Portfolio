import { authFetch } from './auth';

export async function threadRequest(path, options = {}) {
  const response = await authFetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Empty success responses still return null; errors get a useful fallback.
  }

  if (!response.ok) {
    const message = payload?.message;
    throw new Error(
      Array.isArray(message) ? message.join(' ') : message || `Erro ${response.status}.`,
    );
  }

  return payload;
}
