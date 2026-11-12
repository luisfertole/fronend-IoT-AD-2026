import { API_BASE, VEHICLE_ID } from '../../config/app.js';

const KEY = `iot.functions.v1:${API_BASE}:${VEHICLE_ID}`;
const FIELDS = ['encendido', 'sonido', 'luces'];
export function estadoInicial(initial = {}) {
  return Object.fromEntries(FIELDS.map(key => [key, typeof initial?.[key] === 'boolean' ? initial[key] : false]));
}
export function cargarFunciones(storage = globalThis.sessionStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || 'null');
    return estadoInicial(saved?.version === 1 ? saved.funciones : {});
  } catch { return estadoInicial(); }
}
export function guardarFunciones(state, storage = globalThis.sessionStorage) {
  try { storage?.setItem(KEY, JSON.stringify({version:1,funciones:estadoInicial(state)})); }
  catch { /* El control sigue funcionando aunque el almacenamiento esté bloqueado. */ }
}
// Solo campos explícitos; "último comando = ENCENDER_APAGAR" no revela si está encendido.
export function funcionesDeTelemetria(snapshot) {
  const patch = {};
  if (!snapshot || typeof snapshot !== 'object') return patch;
  for (const key of FIELDS) {
    if (typeof snapshot[key] === 'boolean') patch[key] = snapshot[key];
    else if (snapshot[key] === 0 || snapshot[key] === 1) patch[key] = Boolean(snapshot[key]);
  }
  return patch;
}
export function actualizarFuncionesGuardadas(snapshot, storage = globalThis.sessionStorage) {
  const patch = funcionesDeTelemetria(snapshot);
  if (Object.keys(patch).length) guardarFunciones({...cargarFunciones(storage),...patch}, storage);
}
