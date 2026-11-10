import { API_BASE, TIMEOUT_MS, VEHICLE_ID as V } from "./config.js";

let clave = sessionStorage.getItem("clave") || "";   // solo durante la sesión de la pestaña
export const setClave = (c) => { clave = c; sessionStorage.setItem("clave", c); };

export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

const TEXTOS = { 401: "Clave inválida o ausente", 404: "No encontrado", 409: "Hay una DEMO en ejecución", 422: "Datos inválidos" };

async function req(path, { method = "GET", auth = false, body } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const headers = auth ? { "X-API-Key": clave } : {};
    if (body) headers["Content-Type"] = "application/json";
    const r = await fetch(API_BASE + path, { method, signal: ctl.signal, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await r.json(); } catch { /* respuesta sin JSON */ }
    if (!r.ok) throw new ApiError(TEXTOS[r.status] || (typeof data?.detail === "string" ? data.detail : `Error ${r.status}`), r.status);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e.name === "AbortError" ? "Tiempo de espera agotado" : "Sin conexión con la API", 0);
  } finally { clearTimeout(t); }
}

export const api = {
  vehiculo: () => req(`/vehiculos/${V}`),
  comandos: () => req(`/vehiculos/${V}/comandos`),
  demos: () => req(`/vehiculos/${V}/demos`),
  mover: (idComando, ms) => req(`/vehiculos/${V}/mover?id_comando=${idComando}&duracion_ms=${ms}`, { method: "POST", auth: true }),
  detener: () => req(`/vehiculos/${V}/emergencia`, { method: "POST", auth: true }),
  ejecutarDemo: (id) => req(`/vehiculos/${V}/demos/${id}/ejecutar`, { method: "POST", auth: true }),
  cancelarDemo: () => req(`/vehiculos/${V}/demos/cancelar`, { method: "POST", auth: true }),
  vehiculos: () => req("/vehiculos"),
  estado: (id = V) => req(`/vehiculos/${id}/estado`),
  historial: (id = V) => req(`/vehiculos/${id}/historial`),
  listar: (ruta) => req(ruta),
  crear: (ruta, body) => req(ruta, { method: "POST", auth: true, body }),
  borrar: (ruta) => req(ruta, { method: "DELETE", auth: true }),
  salud: (path) => req(path),
};
