import { api } from '../../services/vehicle-api.js';
import { request } from '../../services/http.js';
import { conectarWs } from '../../services/websocket.js';
import { HEALTH_PATH, HEALTH_EVERY_MS, CONTROL_ENDPOINT } from '../../config/app.js';
import { montarMenu } from '../../shared/navigation.js';
import { $ } from '../../shared/dom.js';
import { Controlador } from './controller.js';
import { DIRECCIONES, DIRECCIONES2 } from './commands.js';
import { crearJoystick } from './joystick.js';
import { mostrarMensaje, setIndicador, pintarFunciones, montarBotones, bloquearDemo } from './ui.js';
import { cargarFunciones, guardarFunciones } from './function-state.js';
import { EstadoESP } from './device.js';
import { mountVoice } from '../voice/panel.js';

const ctl = new Controlador({
  notify: mostrarMensaje, onDemo: bloquearDemo, initialFunctions: cargarFunciones(),
  onFunctions: state => { guardarFunciones(state); pintarFunciones(state); },
});
let controlReady=false,savedDemos=[];
const esp=new EstadoESP(value=>setIndicador('esp',value===true?'ok':value===false?'error':'pending',value===true?'Conectada':value===false?'Desconectada':'Sin verificar'),api);
const voice=mountVoice(ctl,{canMove:()=>controlReady&&esp.connected===true,notify:mostrarMensaje,getDemos:()=>savedDemos,getSelectedDemo:()=>$('demo').value});
pintarFunciones(ctl.funciones);
montarMenu();
crearJoystick(ctl, 'joy', DIRECCIONES); crearJoystick(ctl, 'joy2', DIRECCIONES2);
$('detener').addEventListener('click', () => { voice.cancel();ctl.detener(); });
$('demo-run').addEventListener('click', () => ctl.iniciarDemo($('demo').value));
$('demo-cancel').addEventListener('click', () => ctl.cancelarDemo());
const secureStop = () => { if (ctl.ocupado) ctl.detener(); };
window.addEventListener('blur', secureStop);
document.addEventListener('visibilitychange', () => { if (document.hidden) secureStop(); });
window.addEventListener('pagehide', secureStop);

async function health() {
  try {
    await api.salud(HEALTH_PATH);
    const diagnostic=await request(CONTROL_ENDPOINT,{local:true});controlReady=diagnostic?.ready===true;
    setIndicador('api',controlReady?'ok':'pending',controlReady?'Disponible':'Falta clave');
  } catch {controlReady=false;setIndicador('api','error','Sin conexión');}
}
async function load() {
  $('reload').disabled = true;
  try {
    const [vehicle] = await Promise.all([api.vehiculo(), ctl.cargar()]);
    $('veh').textContent = vehicle.nombre || 'Vehículo IoT';
    $('vehicle-model').textContent = vehicle.microcontrolador || vehicle.modelo || 'Vehículo remoto';
    montarBotonesUnaVez();
  } catch (error) { mostrarMensaje('error', error.message); }
  // Solo telemetría explícita puede reemplazar el estado conservado de la sesión.
  const version = ctl.versionFunciones;
  try { const state = await api.estado(); if (version === ctl.versionFunciones) ctl.sincronizarFunciones(state); }
  catch (error) { mostrarMensaje('error', `Estado: ${error.message}`); }
  try {
    const demos = await api.demos(); savedDemos=demos.filter(d => d.activo !== false && d.activo !== 0); $('demo').replaceChildren(new Option('Selecciona una demostración', ''));
    demos.filter(d => d.activo !== false && d.activo !== 0).forEach(d => $('demo').add(new Option(d.nombre || `Demo ${d.id_demo}`, d.id_demo)));
    bloquearDemo(ctl.demo || ctl.demoPendiente);
  } catch (error) { savedDemos=[];mostrarMensaje('error', `DEMO: ${error.message}`); }
  try {
    const status = await request(CONTROL_ENDPOINT, { local: true });
    controlReady=status?.ready===true;
    $('access-note').textContent = status?.ready ? 'Acceso de control listo · no necesitas introducir una clave.' : 'La conexión de control requiere configurar IOT_API_KEY en el servidor.';
    $('access-note').classList.toggle('err', !status?.ready);
  } catch { $('access-note').textContent = 'El acceso de control necesita el servidor Node o el despliegue de Vercel. Consulta README.md.'; $('access-note').classList.add('err'); }
  $('reload').disabled = false;
}
let buttonsMounted = false;
function montarBotonesUnaVez() {
  if (!buttonsMounted) { montarBotones(ctl); buttonsMounted = true; }
  else for (const [id, command] of [['power', 'ENCENDER_APAGAR'], ['sound', 'SONIDO'], ['lights', 'LUCES']]) $(id).disabled = !ctl.tiene(command);
}
$('demo').addEventListener('change', () => bloquearDemo(ctl.demo || ctl.demoPendiente));
$('reload').addEventListener('click', load);
conectarWs({ onEstado: state => {
  const names = { en_linea: 'En línea', conectando: 'Conectando', reconectando: 'Reconectando', desconectado: 'Desconectado' };
  setIndicador('ws', state === 'en_linea' ? 'ok' : state === 'desconectado' ? 'error' : 'pending', names[state]);
}, onEvento: event => { esp.event(event);ctl.evento(event); } });
health(); setInterval(health, HEALTH_EVERY_MS); load();esp.refresh();setInterval(()=>esp.refresh(),5000);
