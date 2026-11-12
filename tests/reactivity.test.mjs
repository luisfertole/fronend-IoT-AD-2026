import test from 'node:test';
import assert from 'node:assert/strict';
import { Controlador } from '../src/features/control/controller.js';
import { MOVE_MS, PULSE_MS } from '../src/config/app.js';
const deferred = () => { let resolve; const promise = new Promise(r => resolve=r); return {promise,resolve}; };
function setup(overrides = {}, options = {}) {
  const tasks = new Map(); let id=0, time=0;
  const ctl = new Controlador({
    client:{comandos:async()=>[],mover:async()=>{},detener:async()=>{},...overrides},
    schedule:(fn,delay)=>{const token=++id;tasks.set(token,{fn,delay});return token;},
    unschedule:token=>tasks.delete(token),now:()=>time,...options,
  });
  ['AVANZAR','RETROCEDER','DERECHA','ENCENDER_APAGAR','SONIDO','LUCES'].forEach((name,i)=>ctl.catalogo.set(name,{id_comando:i+1}));
  return {ctl,tasks,advance:ms=>time+=ms};
}
test('cruzar el centro conserva la dirección contraria mientras responde STOP',async()=>{
  const stop=deferred(),sent=[];
  const {ctl}=setup({detener:()=>stop.promise,mover:async id=>sent.push(id)});
  await ctl.iniciar('AVANZAR');
  const stopping=ctl.detener();const reverse=ctl.iniciar('RETROCEDER');
  await Promise.resolve();assert.deepEqual(sent,[1]);
  stop.resolve();await stopping;assert.equal(await reverse,true);
  assert.deepEqual(sent,[1,2]);assert.equal(ctl.deseado,'RETROCEDER');
});
test('si cambian varias direcciones durante STOP solo ejecuta la última',async()=>{
  const stop=deferred(),sent=[];const {ctl}=setup({detener:()=>stop.promise,mover:async id=>sent.push(id)});
  const stopping=ctl.detener();const a=ctl.iniciar('AVANZAR'),b=ctl.iniciar('RETROCEDER'),c=ctl.iniciar('DERECHA');
  stop.resolve();await Promise.all([stopping,a,b,c]);assert.deepEqual(sent,[3]);
});
test('una nueva dirección invalida otra que esperaba el STOP interno',async()=>{
  const stop=deferred(),entered=deferred(),sent=[];
  const {ctl}=setup({mover:async id=>sent.push(id),detener:async()=>{entered.resolve();await stop.promise;}});
  await ctl.iniciar('AVANZAR');const reverse=ctl.iniciar('RETROCEDER');await entered.promise;
  const latest=ctl.iniciar('DERECHA');stop.resolve();await Promise.all([reverse,latest]);
  assert.deepEqual(sent,[1,3]);
});
test('mantener una dirección envía una orden de 5 s, sin ciclos de movimiento y parada',async()=>{
  const sent=[];let stops=0;const {ctl,tasks}=setup({mover:async(id,ms)=>sent.push({id,ms}),detener:async()=>stops++});
  await ctl.iniciar('AVANZAR');assert.equal(tasks.size,1);
  const [token,task]=[...tasks.entries()][0];tasks.delete(token);task.fn();await ctl.cola;
  assert.deepEqual(sent,[{id:1,ms:5000}]);assert.equal(stops,0);
  assert.equal(tasks.size,0);assert.equal(ctl.activo,null);
  await ctl.detener();assert.equal(tasks.size,0);assert.equal(ctl.deseado,null);
});
test('liberar impide que un temporizador atrasado reactive el movimiento',async()=>{
  const sent=[];const {ctl,tasks}=setup({mover:async id=>sent.push(id)});
  await ctl.iniciar('AVANZAR');const task=[...tasks.values()][0];await ctl.detener();task.fn();await ctl.cola;
  assert.deepEqual(sent,[1]);assert.equal(ctl.ocupado,false);
});
test('si EC2 espera la duración, al responder solo expira el estado local',async()=>{
  let advance;const state=setup({mover:async()=>advance(MOVE_MS)});advance=state.advance;
  await state.ctl.iniciar('AVANZAR');assert.equal([...state.tasks.values()][0].delay,0);
});
test('blur y pointerup simultáneos comparten una parada, otra intención permite un STOP nuevo',async()=>{
  const gate=deferred();let stops=0;const {ctl}=setup({detener:async()=>{stops++;await gate.promise;}});
  const a=ctl.detener(),b=ctl.detener();assert.equal(stops,1);
  const move=ctl.iniciar('AVANZAR');const c=ctl.detener();assert.equal(stops,2);
  gate.resolve();await Promise.all([a,b,c,move]);assert.equal(ctl.deseado,null);
});
test('sonido, luces y encendido no se renuevan y usan pulsos breves',async()=>{
  const sent=[];const {ctl,tasks}=setup({mover:async(id,ms)=>sent.push(ms)});
  await ctl.iniciar('ENCENDER_APAGAR');await ctl.iniciar('SONIDO');await ctl.iniciar('LUCES');
  assert.deepEqual(sent,[PULSE_MS,PULSE_MS,PULSE_MS]);assert.equal(tasks.size,0);
});
test('no mueve si la parada anterior falló; se recupera con un STOP confirmado',async()=>{
  let fail=true;const sent=[];const {ctl}=setup({mover:async id=>sent.push(id),detener:async()=>{if(fail)throw Error('sin red');}});
  await ctl.detener();assert.equal(await ctl.iniciar('AVANZAR'),false);assert.deepEqual(sent,[]);
  fail=false;await ctl.detener();assert.equal(await ctl.iniciar('RETROCEDER'),true);assert.deepEqual(sent,[2]);
});
test('una entrada repetida de la misma dirección no reinicia el movimiento ni su plazo',async()=>{
  const sent=[];const {ctl}=setup({mover:async id=>sent.push(id)});
  await ctl.iniciar('AVANZAR');const timer=ctl.timer;
  await ctl.iniciar('AVANZAR');assert.deepEqual(sent,[1]);assert.equal(ctl.timer,timer);
});
test('el temporizador de una dirección anterior no borra una dirección nueva',async()=>{
  const {ctl,tasks}=setup();await ctl.iniciar('AVANZAR');const old=[...tasks.values()][0];
  await ctl.iniciar('RETROCEDER');old.fn();assert.equal(ctl.activo,'RETROCEDER');assert.equal(ctl.deseado,'RETROCEDER');
});
