// Proxy con rutas limitadas: lecturas públicas y administración con la clave del administrador.
// La clave IOT_API_KEY del servidor solo se usa en control-gateway.mjs.
export async function backendGateway(req, res, { env = process.env, fetcher = fetch } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, data) => res.status(code).json(data);
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { detail: 'Origen no permitido' });
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return send(403, { detail: 'Origen no permitido' }); }
    catch { return send(403, { detail: 'Origen no válido' }); }
  }
  const path = req.query?.path;
  if (typeof path !== 'string') return send(400, { detail: 'Ruta no válida' });
  const read = /^\/$|^\/vehiculos$|^\/vehiculos\/[1-9]\d*(?:\/(?:comandos|demos|estado|historial))?$/;
  const create = /^\/vehiculos(?:\/[1-9]\d*\/(?:comandos|demos))?$/;
  const remove = /^\/vehiculos\/[1-9]\d*(?:\/(?:comandos|demos)\/[1-9]\d*)?$/;
  const allowed = req.method === 'GET' ? read.test(path) : req.method === 'POST' ? create.test(path) : req.method === 'DELETE' ? remove.test(path) : false;
  if (!allowed) return send(400, { detail: 'Operación no permitida en esta ruta' });
  const headers = { Accept: 'application/json' };
  let body;
  if (req.method !== 'GET') {
    const key = req.headers['x-api-key'];
    if (typeof key !== 'string' || !key.trim()) return send(401, { detail: 'Introduce la clave administrativa para realizar esta operación' });
    headers['X-API-Key'] = key;
    if (req.method === 'POST') {
      let parsed = req.body;
      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { return send(400, { detail: 'JSON no válido' }); } }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return send(400, { detail: 'Datos no válidos' });
      body = JSON.stringify(parsed);
      if (Buffer.byteLength(body) > 8192) return send(413, { detail: 'Solicitud demasiado grande' });
      headers['Content-Type'] = 'application/json';
    }
  }
  try {
    const upstream = new URL(env.IOT_API_BASE || 'https://iot-vehiculos.duckdns.org');
    if (!['https:', 'http:'].includes(upstream.protocol) || upstream.username || upstream.password) throw new Error('Configuración no válida');
    const response = await fetcher(new URL(path, upstream), { method: req.method, headers, body, signal: AbortSignal.timeout(5500), redirect: 'error' });
    if (!response.ok) return send(response.status, { detail: ({401:'Clave administrativa inválida',403:'Operación no autorizada por EC2',404:'Recurso no encontrado en EC2',409:'La operación entra en conflicto con el estado actual',422:'EC2 rechazó los datos enviados'})[response.status] || `El servidor EC2 respondió ${response.status}` });
    if (req.method !== 'GET') return send(200, { ok: true });
    const data = await response.json();
    return send(200, data);
  } catch (error) {
    return send(502, { detail: error.name === 'TimeoutError' ? 'EC2 agotó el tiempo de espera' : 'No se pudo obtener la respuesta de EC2' });
  }
}
