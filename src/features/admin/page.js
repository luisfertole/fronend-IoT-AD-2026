import { api } from '../../services/vehicle-api.js';
import { setAdminKey } from '../../services/http.js';
import { montarMenu } from '../../shared/navigation.js';
import { $, textElement, message } from '../../shared/dom.js';

let generation = 0;
const value = id => $(id).value.trim();
function table(container, columns, rows, remove) {
  const table = document.createElement('table'); table.className = 'data-table';
  const head = document.createElement('thead'), headings = document.createElement('tr');
  [...columns.map(([key, label]) => label), 'Acciones'].forEach(label => { const cell = textElement('th', label); cell.scope = 'col'; headings.append(cell); });
  head.append(headings); table.append(head);
  const body = document.createElement('tbody');
  for (const item of rows) {
    const row = document.createElement('tr');
    columns.forEach(([key]) => row.append(textElement('td', item[key] ?? '—')));
    const cell = document.createElement('td'), button = textElement('button', 'Eliminar', 'delete-button');
    button.type = 'button'; button.setAttribute('aria-label', `Eliminar ${item.nombre || 'registro'}`);
    button.addEventListener('click', () => remove(item)); cell.append(button); row.append(cell); body.append(row);
  }
  if (!rows.length) { const row = document.createElement('tr'), cell = textElement('td', 'Sin registros disponibles', 'empty-cell'); cell.colSpan = columns.length + 1; row.append(cell); body.append(row); }
  table.append(body); $(container).replaceChildren(table);
}
async function action(fn, success, form) {
  const buttons = form ? [...form.querySelectorAll('button')] : [];
  buttons.forEach(button => button.disabled = true);
  try { await fn(); if (form) form.reset(); message(success); }
  catch (error) { message(error.message, true); }
  finally { buttons.forEach(button => button.disabled = false); }
}
function emptyChildren() {
  table('t-cmd', [['id_comando','ID'],['nombre','Nombre'],['codigo','Código'],['activo','Activo']], [], () => {});
  table('t-demo', [['id_demo','ID'],['nombre','Nombre'],['activo','Activo']], [], () => {});
}
async function loadChildren() {
  const version = ++generation, id = $('veh').value;
  emptyChildren();
  $('command-form').querySelector('button').disabled = !id;
  $('demo-form').querySelector('button').disabled = !id;
  if (!id) return;
  const [commands, demos] = await Promise.all([api.listar(`/vehiculos/${id}/comandos`), api.listar(`/vehiculos/${id}/demos`)]);
  if (version !== generation) return;
  table('t-cmd', [['id_comando','ID'],['nombre','Nombre'],['codigo','Código'],['activo','Activo']], commands, item => {
    if (confirm(`¿Eliminar el comando ${item.nombre}?`)) action(async () => { await api.borrar(`/vehiculos/${id}/comandos/${item.id_comando}`); await loadChildren(); }, 'Comando eliminado');
  });
  table('t-demo', [['id_demo','ID'],['nombre','Nombre'],['activo','Activo']], demos, item => {
    if (confirm(`¿Eliminar la DEMO ${item.nombre}?`)) action(async () => { await api.borrar(`/vehiculos/${id}/demos/${item.id_demo}`); await loadChildren(); }, 'DEMO eliminada');
  });
}
async function load() {
  const vehicles = await api.vehiculos(), previous = $('veh').value;
  table('t-veh', [['id_vehiculo','ID'],['nombre','Nombre'],['modelo','Modelo'],['microcontrolador','Dispositivo']], vehicles, item => {
    if (confirm(`¿Eliminar el vehículo ${item.nombre}?`)) action(async () => { await api.borrar(`/vehiculos/${item.id_vehiculo}`); await load(); }, 'Vehículo eliminado');
  });
  $('veh').replaceChildren(...vehicles.map(vehicle => new Option(vehicle.nombre, vehicle.id_vehiculo)));
  if (vehicles.some(vehicle => String(vehicle.id_vehiculo) === previous)) $('veh').value = previous;
  await loadChildren();
}
function submit(id, fn, success) {
  $(id).addEventListener('submit', event => { event.preventDefault(); if (event.currentTarget.reportValidity()) action(fn, success, event.currentTarget); });
}
submit('vehicle-form', async () => {
  if (!value('v-nombre') || !value('v-modelo') || !value('v-micro')) throw new Error('Completa nombre, modelo y microcontrolador');
  await api.crear('/vehiculos', { nombre: value('v-nombre'), modelo: value('v-modelo'), microcontrolador: value('v-micro'), descripcion: value('v-desc') }); await load();
}, 'Vehículo creado');
submit('command-form', async () => {
  const id = $('veh').value, code = Number(value('c-codigo'));
  if (!id || !value('c-nombre') || !value('c-codigo') || !Number.isInteger(code) || code < 0 || code > 255) throw new Error('Selecciona un vehículo, un nombre y un código entero entre 0 y 255');
  await api.crear(`/vehiculos/${id}/comandos`, { nombre: value('c-nombre'), codigo: code, descripcion: value('c-desc') }); await loadChildren();
}, 'Comando creado');
submit('demo-form', async () => {
  const id = $('veh').value;
  if (!id || !value('d-nombre')) throw new Error('Selecciona un vehículo y escribe un nombre');
  await api.crear(`/vehiculos/${id}/demos`, { nombre: value('d-nombre'), descripcion: value('d-desc') }); await loadChildren();
}, 'DEMO creada');
$('admin-access').addEventListener('submit', event => { event.preventDefault(); setAdminKey(value('clave')); $('clave').value = ''; message('Clave guardada en esta sesión. Se validará al realizar una operación administrativa.'); });
$('veh').addEventListener('change', () => loadChildren().catch(error => message(error.message, true)));
montarMenu(); load().catch(error => message(error.message, true));
