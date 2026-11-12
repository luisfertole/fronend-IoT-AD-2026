const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;

// Únicamente operaciones de control. No permite rutas arbitrarias ni acciones administrativas.
export async function controlGateway(req, res, { env = process.env, fetcher = fetch } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, body) => res.status(status).json(body);
  const vehicle = Number(env.IOT_VEHICLE_ID || 1);
  const configured = Boolean(env.IOT_API_KEY?.trim() && env.IOT_API_KEY.trim() !== 'tu_clave');
  if (!integer(vehicle, 1)) return send(503, { detail: 'IOT_VEHICLE_ID no es válido en el servidor' });
  if (req.method === 'GET') return send(200, { ready: configured, vehicle });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, { detail: 'Método no permitido' }); }
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { detail: 'Origen no permitido' });
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return send(403, { detail: 'Origen no permitido' }); }
    catch { return send(403, { detail: 'Origen no válido' }); }
  }
  if (!configured) return send(503, { detail: 'Configura IOT_API_KEY en .env.local o en Vercel y reinicia el servidor o vuelve a desplegar' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return send(400, { detail: 'JSON no válido' }); } }
  if (!body || Array.isArray(body) || typeof body !== 'object') return send(400, { detail: 'Solicitud no válida' });
  const base = `/vehiculos/${vehicle}`;
  let path;
  switch (body.action) {
    case 'mover':
      if (!integer(body.id_comando, 1) || !integer(body.duracion_ms, 50, 5000)) return send(422, { detail: 'Comando o duración no válidos (50–5000 ms)' });
      path = `${base}/mover?id_comando=${body.id_comando}&duracion_ms=${body.duracion_ms}`; break;
    case 'detener': path = `${base}/emergencia`; break;
    case 'demo':
      if (!integer(body.id_demo, 1)) return send(422, { detail: 'DEMO no válida' });
      path = `${base}/demos/${body.id_demo}/ejecutar`; break;
    case 'cancelar': path = `${base}/demos/cancelar`; break;
    default: return send(400, { detail: 'Acción de control no permitida' });
  }
  try {
    const upstream = new URL(env.IOT_API_BASE || 'https://iot-vehiculos.duckdns.org');
    if (!['https:', 'http:'].includes(upstream.protocol) || upstream.username || upstream.password) throw new Error('Configuración no válida');
    const response = await fetcher(new URL(path, upstream), {
      method: 'POST', headers: { 'X-API-Key': env.IOT_API_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(5500), redirect: 'error',
    });
    // No replica encabezados, claves ni contenido arbitrario del backend.
    if (!response.ok) return send(response.status, { detail: ({401: 'El servidor rechazó la clave configurada', 403: 'El servidor no autorizó la operación', 404: 'El recurso solicitado no existe en el backend', 409: 'Hay una DEMO en ejecución', 422: 'El backend rechazó los datos'})[response.status] || 'El servidor IoT rechazó la operación' });
    return send(200, { ok: true });
  } catch (error) {
    return send(502, { detail: error.name === 'TimeoutError' ? 'El servidor IoT agotó el tiempo de espera' : 'No se pudo conectar con el servidor IoT' });
  }
}
