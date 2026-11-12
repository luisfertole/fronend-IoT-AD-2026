// Se inyecta SOLO con npm run preview. Nunca conecta con el servidor ni con el vehículo.
const commands = ['ENCENDER_APAGAR','GIRAR_IZQUIERDA','RETROCEDER','AVANZAR','GIRAR_DERECHA','SONIDO','LUCES','LEVANTAR','IZQUIERDA','BAJAR','DERECHA'].map((nombre,index) => ({nombre,id_comando:index+1,codigo:index+1,activo:true}));
let vehicles = [{id_vehiculo:1,nombre:'Vehículo IoT ESP8266',modelo:'Control 74HC595 + PC817',microcontrolador:'ESP8266'}];
let demos = [{id_demo:1,nombre:'Demo de maniobra',activo:true}];
let history = [];
const peers = new Set();
function emit(event) { peers.forEach(peer => peer.onmessage?.({data:JSON.stringify(event)})); }
class MockSocket {
  static OPEN = 1; static CLOSED = 3;
  constructor() { this.readyState = 0; peers.add(this); setTimeout(() => { if (this.readyState === 3) return; this.readyState = 1; this.onopen?.(); }, 100); }
  close() { this.readyState = 3; peers.delete(this); this.onclose?.(); }
}
window.WebSocket = MockSocket;
window.fetch = async (input, options = {}) => {
  const url = new URL(input, location.origin), path = url.pathname === '/api/backend' ? url.searchParams.get('path') : url.pathname, method = options.method || 'GET';
  let data;
  if (path === '/api/control') {
    const body = options.body ? JSON.parse(options.body) : {};
    if (method === 'GET') data = {ready:true,mock:true,vehicle:1};
    else {
      if (body.action === 'mover') {
        const command = commands.find(c => c.id_comando === body.id_comando);
        const record = {fecha_hora:new Date().toLocaleString(),comando:command?.nombre,codigo:command?.codigo,origen:'SIMULACIÓN'};
        history.unshift(record); history = history.slice(0,10);
        setTimeout(() => emit({tipo:'MOVIMIENTO_INDIVIDUAL',...record}), 20);
      }
      if (body.action === 'detener') setTimeout(() => emit({tipo:'EMERGENCIA'}),20);
      if (body.action === 'demo') { setTimeout(() => emit({tipo:'DEMO_INICIADA'}),20); setTimeout(() => emit({tipo:'DEMO_FINALIZADA'}),4000); }
      if (body.action === 'cancelar') setTimeout(() => emit({tipo:'DEMO_CANCELADA'}),20);
      data = {ok:true};
    }
  } else if (path === '/vehiculos' && method === 'POST') { const vehicle = {...JSON.parse(options.body),id_vehiculo:Math.max(0,...vehicles.map(v=>v.id_vehiculo))+1}; vehicles.push(vehicle); data=vehicle; }
  else if (path === '/vehiculos') data = vehicles;
  else if (/\/vehiculos\/\d+$/.test(path) && method === 'DELETE') { vehicles = vehicles.filter(v=>v.id_vehiculo!==Number(path.split('/').pop())); data={ok:true}; }
  else if (path.endsWith('/comandos') && method === 'POST') { const command = {...JSON.parse(options.body),id_comando:commands.length+1,activo:true}; commands.push(command); data=command; }
  else if (path.endsWith('/comandos')) data = commands;
  else if (/\/comandos\/\d+$/.test(path) && method === 'DELETE') { const i=commands.findIndex(c=>c.id_comando===Number(path.split('/').pop())); if(i>=0)commands.splice(i,1); data={ok:true}; }
  else if (path.endsWith('/demos') && method === 'POST') { const demo={...JSON.parse(options.body),id_demo:demos.length+1,activo:true}; demos.push(demo); data=demo; }
  else if (path.endsWith('/demos')) data = demos;
  else if (/\/demos\/\d+$/.test(path) && method === 'DELETE') { demos=demos.filter(d=>d.id_demo!==Number(path.split('/').pop())); data={ok:true}; }
  else if (path.endsWith('/estado')) data = {id_vehiculo:1,vehiculo:'Vehículo IoT ESP8266',comando:history[0]?.comando || 'EN REPOSO',conectado:'Simulado',fecha_actualizacion:new Date().toLocaleString()};
  else if (path.endsWith('/historial')) data = {historial:history};
  else if (/\/vehiculos\/\d+$/.test(path)) data = vehicles.find(v=>v.id_vehiculo===Number(path.split('/').pop())) || vehicles[0] || {};
  else data = {status:'API simulada'};
  return new Response(JSON.stringify(data), {status:200,headers:{'Content-Type':'application/json'}});
};
document.addEventListener('DOMContentLoaded', () => {
  const badge = document.createElement('div'); badge.className = 'preview-banner'; badge.textContent = 'VISTA SIMULADA · SIN CONEXIÓN AL VEHÍCULO';
  badge.style.cssText = 'height:24px;background:#ffae52;color:#221608;display:grid;place-items:center;font:9px Consolas,monospace;letter-spacing:.06em';
  document.body.prepend(badge);
});
