import { TIMEOUT_MS } from '../config/app.js';

export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'ApiError'; this.status = status; }
}
export function setAdminKey(key) { sessionStorage.setItem('iot.adminKey', key.trim()); }

export async function request(path, { method = 'GET', body, admin = false, local = false, keepalive = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (admin) headers['X-API-Key'] = sessionStorage.getItem('iot.adminKey') || '';
    // REST siempre usa el mismo origen. Node/Vercel se comunica con EC2 sin CORS del navegador.
    const endpoint = local ? path : `/api/backend?path=${encodeURIComponent(path)}`;
    const response = await fetch(endpoint, {
      method, headers, signal: controller.signal, keepalive,
      body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : null;
      throw new ApiError(detail || ({401: 'Clave administrativa inválida', 404: 'Recurso no encontrado', 409: 'Hay una DEMO en ejecución', 422: 'Revisa los datos enviados'}[response.status]) || `Error ${response.status}`, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'Tiempo de espera agotado' : 'No se pudo conectar con el servidor');
  } finally { clearTimeout(timeout); }
}
