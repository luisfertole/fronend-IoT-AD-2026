import { request } from './http.js';
import { VEHICLE_ID as V, CONTROL_ENDPOINT } from '../config/app.js';

const control = (action, data = {}, options = {}) => request(CONTROL_ENDPOINT, {
  method: 'POST', local: true, body: { action, ...data }, ...options,
});
export const api = {
  vehiculo: () => request(`/vehiculos/${V}`),
  comandos: () => request(`/vehiculos/${V}/comandos`),
  demos: () => request(`/vehiculos/${V}/demos`),
  mover: (id_comando, duracion_ms) => control('mover', { id_comando, duracion_ms }),
  detener: () => control('detener', {}, { keepalive: true }),
  ejecutarDemo: (id_demo) => control('demo', { id_demo: Number(id_demo) }),
  cancelarDemo: () => control('cancelar'),
  vehiculos: () => request('/vehiculos'),
  estado: (id = V) => request(`/vehiculos/${id}/estado`),
  historial: (id = V) => request(`/vehiculos/${id}/historial`),
  listar: (path) => request(path),
  crear: (path, body) => request(path, { method: 'POST', body, admin: true }),
  borrar: (path) => request(path, { method: 'DELETE', admin: true }),
  salud: (path) => request(path),
};
