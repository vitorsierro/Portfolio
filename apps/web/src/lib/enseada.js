import { authFetch } from './auth';

const BASE = '/admin/enseada';

async function json(response) {
  if (!response.ok) {
    // A API devolve `message` do class-validator (string ou array).
    const body = await response.json().catch(() => ({}));
    const detail = Array.isArray(body.message)
      ? body.message.join('; ')
      : body.message;
    throw new Error(detail || `Erro ${response.status}`);
  }
  return response.json();
}

function crud(resource) {
  return {
    list: () => authFetch(`${BASE}/${resource}`).then(json),
    create: (data) =>
      authFetch(`${BASE}/${resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(json),
    update: (id, data) =>
      authFetch(`${BASE}/${resource}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(json),
    remove: (id) =>
      authFetch(`${BASE}/${resource}/${id}`, { method: 'DELETE' }).then(json),
    reorder: (ids) =>
      authFetch(`${BASE}/${resource}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).then(json),
  };
}

export const spaces = crud('spaces');
export const amenities = crud('amenities');
export const restaurants = crud('restaurants');
export const activities = crud('activities');
export const faq = crud('faq');

// Property e Model3d são registros únicos: só leitura e gravação.
export const property = {
  get: () => authFetch(`${BASE}/property`).then(json),
  save: (data) =>
    authFetch(`${BASE}/property`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json),
};

export const model3d = {
  get: () => authFetch(`${BASE}/model3d`).then(json),
  save: (data) =>
    authFetch(`${BASE}/model3d`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json),
};

export const preview = () => authFetch(`${BASE}/preview`).then(json);

// Upload usa multipart — sem Content-Type manual, o browser precisa definir
// o boundary sozinho.
export async function uploadImage(file, folder = 'geral') {
  const form = new FormData();
  form.append('file', file);
  return authFetch(`${BASE}/upload?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    body: form,
  }).then(json);
}
