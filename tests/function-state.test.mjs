import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarFunciones, guardarFunciones, actualizarFuncionesGuardadas } from '../src/features/control/function-state.js';
import { Controlador } from '../src/features/control/controller.js';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test('conserva las tres funciones al recrear Control tras visitar otra página',async()=>{
  const storage=memory();
  const ctl=new Controlador({client:{mover:async()=>{}},initialFunctions:cargarFunciones(storage),onFunctions:s=>guardarFunciones(s,storage)});
  ctl.catalogo.set('ENCENDER_APAGAR',{id_comando:1});ctl.catalogo.set('SONIDO',{id_comando:2});
  await ctl.iniciar('ENCENDER_APAGAR');await ctl.iniciar('SONIDO');
  const restored=new Controlador({initialFunctions:cargarFunciones(storage)});
  assert.deepEqual(restored.funciones,{encendido:true,sonido:false,luces:true});
});
test('estado sin booleans no apaga indicadores conservados ni interpreta el último comando',()=>{
  const storage=memory();guardarFunciones({encendido:true,sonido:true,luces:true},storage);
  actualizarFuncionesGuardadas({comando:'ENCENDER_APAGAR',codigo:1,conectado:1},storage);
  assert.deepEqual(cargarFunciones(storage),{encendido:true,sonido:true,luces:true});
});
test('la telemetría explícita sustituye los campos conservados que informa',()=>{
  const storage=memory();guardarFunciones({encendido:true,sonido:true,luces:true},storage);
  actualizarFuncionesGuardadas({luces:0,sonido:false},storage);
  assert.deepEqual(cargarFunciones(storage),{encendido:true,sonido:false,luces:false});
  const ctl=new Controlador({initialFunctions:cargarFunciones(storage)});
  ctl.evento({tipo:'ESTADO_DISPOSITIVO',estado:{encendido:0,luces:1}});
  assert.deepEqual(ctl.funciones,{encendido:false,sonido:false,luces:true});
});
test('sin almacenamiento y con datos dañados inicia sin bloquear la página',()=>{
  assert.doesNotThrow(()=>guardarFunciones({encendido:true},{setItem:()=>{throw Error('bloqueado');}}));
  assert.deepEqual(cargarFunciones({getItem:()=>'{roto'}),{encendido:false,sonido:false,luces:false});
});
test('telemetría recibida antes del POST aceptado no invierte sonido dos veces',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);
  const ctl=new Controlador({client:{mover:()=>pending},initialFunctions:{encendido:true,sonido:false,luces:true}});
  ctl.catalogo.set('SONIDO',{id_comando:1});const job=ctl.iniciar('SONIDO');
  await Promise.resolve();await Promise.resolve();
  ctl.evento({tipo:'ESTADO_DISPOSITIVO',estado:{sonido:true}});resolve();await job;
  assert.equal(ctl.funciones.sonido,true);
});
