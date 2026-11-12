import { api } from '../../services/vehicle-api.js';
import { conectarWs } from '../../services/websocket.js';
import { montarMenu } from '../../shared/navigation.js';
import { $, textElement, message } from '../../shared/dom.js';
import { VEHICLE_ID } from '../../config/app.js';
import { actualizarFuncionesGuardadas } from '../control/function-state.js';

const names = { en_linea: 'En línea', conectando: 'Conectando', reconectando: 'Reconectando', desconectado: 'Desconectado' };
let socket, generation = 0, historyRequest = 0, refreshing = false;
function paintState(state) {
  const list = document.createElement('dl'); list.className = 'state-grid';
  for (const [key, value] of Object.entries(state || {})) {
    const row = document.createElement('div'); row.className = 'state-row';
    row.append(textElement('dt', key.replaceAll('_', ' ')), textElement('dd', typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')));
    list.append(row);
  }
  if (!list.children.length) list.append(textElement('p', 'Sin estado disponible', 'muted'));
  $('estado').replaceChildren(list); $('estado').classList.remove('state-grid');
}
async function history(id, version) {
  const request = ++historyRequest;
  const data = await api.historial(id);
  if (version !== generation || request !== historyRequest) return;
  const rows = (Array.isArray(data) ? data : data?.historial || []).slice(0, 10).map(item => {
    const row = document.createElement('tr');
    [item.fecha_hora, item.comando, item.codigo, item.origen].forEach(value => row.append(textElement('td', value ?? '—')));
    return row;
  });
  if (!rows.length) { const row = document.createElement('tr'), cell = textElement('td', 'Sin movimientos registrados', 'empty-cell'); cell.colSpan = 4; row.append(cell); rows.push(row); }
  $('hist').replaceChildren(...rows);
}
function load() {
  const id = $('veh').value, version = ++generation; historyRequest++;
  if (socket) socket.cerrar();
  message(''); $('eventos').replaceChildren();
  paintState(null); $('hist').replaceChildren();
  if (!id) { message('No hay vehículos disponibles'); return; }
  let stateEvents = 0;
  // Abre el socket antes del GET; una respuesta REST atrasada no pisa el estado recibido en vivo.
  socket = conectarWs({ onEstado: state => { if (version === generation) $('ws-est').textContent = names[state]; }, onEvento: event => {
    if (version !== generation) return;
    if (String(id) === String(VEHICLE_ID)) actualizarFuncionesGuardadas(event.estado || event);
    if (event.estado) { stateEvents++; paintState(event.estado); }
    const row = textElement('div', '', 'event-row');
    row.append(textElement('time', new Date().toLocaleTimeString()), document.createTextNode(`${event.tipo || 'EVENTO'}${event.comando ? ' · ' + event.comando : ''}${event.orden ? ' · ' + event.orden + '/' + event.total_movimientos : ''}`));
    $('eventos').prepend(row);
    while ($('eventos').children.length > 100) $('eventos').lastChild.remove();
    if (['MOVIMIENTO_INDIVIDUAL','DEMO_MOVIMIENTO','DEMO_FINALIZADA','EMERGENCIA'].includes(event.tipo) && !refreshing) {
      refreshing = true;
      history(id, version).catch(error => { if (version === generation) message(error.message, true); }).finally(() => { refreshing = false; });
    }
  } }, id);
  api.estado(id).then(state => { if (version === generation && stateEvents === 0) { paintState(state); if (String(id) === String(VEHICLE_ID)) actualizarFuncionesGuardadas(state); } }).catch(error => { if (version === generation) message(error.message, true); });
  history(id, version).catch(error => { if (version === generation) message(error.message, true); });
}
montarMenu();
api.vehiculos().then(vehicles => {
  vehicles.forEach(vehicle => $('veh').add(new Option(vehicle.nombre || `Vehículo ${vehicle.id_vehiculo}`, vehicle.id_vehiculo)));
  if (vehicles.some(vehicle => String(vehicle.id_vehiculo) === String(VEHICLE_ID))) $('veh').value = String(VEHICLE_ID);
  load();
}).catch(error => message(error.message, true));
$('veh').addEventListener('change', load);
window.addEventListener('pagehide', () => socket?.cerrar());
