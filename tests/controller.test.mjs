import test from 'node:test';
import assert from 'node:assert/strict';
import { Controlador } from '../src/features/control/controller.js';
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
function controller(overrides = {}, options = {}) {
  const client = {comandos:async()=>[], mover:async()=>{}, detener:async()=>{}, ejecutarDemo:async()=>{}, cancelarDemo:async()=>{}, ...overrides};
  const ctl = new Controlador({client,...options});
  ['AVANZAR','DERECHA','RETROCEDER','ENCENDER_APAGAR','SONIDO','LUCES'].forEach((name,i)=>ctl.catalogo.set(name,{id_comando:i+1}));
  return ctl;
}
test('DETENER invalida el movimiento durante el cambio de dirección', async () => {
  const gate=deferred(), entered=deferred(), calls=[]; let stops=0;
  const ctl=controller({detener:async()=>{calls.push('STOP'); if(++stops===1){entered.resolve();await gate.promise;}},mover:async()=>calls.push('MOVE')});
  ctl.activo='AVANZAR'; const move=ctl.iniciar('DERECHA'); await entered.promise;
  await ctl.detener(); gate.resolve(); await move;
  assert.deepEqual(calls,['STOP','STOP']);
});
test('una respuesta tardía de movimiento provoca una nueva parada', async () => {
  const gate=deferred(), entered=deferred(); let stops=0;
  const ctl=controller({mover:async()=>{entered.resolve();await gate.promise;},detener:async()=>stops++});
  const move=ctl.iniciar('AVANZAR'); await entered.promise;
  assert.equal(ctl.ocupado,true); assert.equal(ctl.activo,null);
  await ctl.detener(); gate.resolve(); await move;
  assert.equal(stops,2); assert.equal(ctl.activo,null); assert.equal(ctl.ocupado,false);
});
test('no reactiva la DEMO con una respuesta posterior a DETENER', async () => {
  const gate=deferred(); let stops=0;
  const ctl=controller({ejecutarDemo:()=>gate.promise,detener:async()=>stops++});
  const job=ctl.iniciarDemo(1); assert.equal(ctl.demoPendiente,true);
  await ctl.detener(); gate.resolve(); await job;
  assert.equal(ctl.demo,false); assert.equal(ctl.demoPendiente,false); assert.equal(stops,2);
});
test('DEMO finalizada por WSS antes de responder el POST permanece finalizada', async () => {
  const gate=deferred(); const ctl=controller({ejecutarDemo:()=>gate.promise});
  const job=ctl.iniciarDemo(1); ctl.evento({tipo:'DEMO_FINALIZADA'}); gate.resolve(); await job;
  assert.equal(ctl.demo,false);
});
test('encendido aceptado activa las tres funciones; sonido y luces se alternan', async () => {
  const states=[]; const ctl=controller({}, {onFunctions:s=>states.push(s)});
  assert.deepEqual(ctl.funciones,{encendido:false,sonido:false,luces:false});
  await ctl.iniciar('ENCENDER_APAGAR'); assert.deepEqual(ctl.funciones,{encendido:true,sonido:true,luces:true});
  await ctl.iniciar('SONIDO'); assert.equal(ctl.funciones.sonido,false);
  await ctl.iniciar('LUCES'); assert.equal(ctl.funciones.luces,false);
  await ctl.iniciar('ENCENDER_APAGAR'); assert.deepEqual(ctl.funciones,{encendido:false,sonido:false,luces:false});
  assert.equal(states.length,4);
});
test('un POST rechazado no ilumina ni cambia el estado del botón', async () => {
  const ctl=controller({mover:async()=>{throw new Error('fallo');}});
  assert.equal(await ctl.iniciar('ENCENDER_APAGAR'),false);
  assert.equal(ctl.funciones.encendido,false);
});
test('solo se envía la última dirección pendiente', async () => {
  const sent=[]; const ctl=controller({mover:async id=>sent.push(id)});
  await Promise.all([ctl.iniciar('AVANZAR'),ctl.iniciar('DERECHA'),ctl.iniciar('RETROCEDER')]);
  assert.deepEqual(sent,[3]); clearTimeout(ctl.timer);
});
test('cancela una DEMO mientras el inicio está pendiente', async () => {
  const gate=deferred(); const ctl=controller({ejecutarDemo:()=>gate.promise});
  const job=ctl.iniciarDemo(1); await ctl.cancelarDemo(); gate.resolve(); await job;
  assert.equal(ctl.demo,false);
});
test('un evento EMERGENCIA del cambio de dirección no cancela su propia orden', async () => {
  let sent=0; const ctl=controller({detener:async()=>ctl.evento({tipo:'EMERGENCIA'}),mover:async()=>sent++});
  ctl.activo='AVANZAR'; await ctl.iniciar('DERECHA'); assert.equal(sent,1); clearTimeout(ctl.timer);
});
