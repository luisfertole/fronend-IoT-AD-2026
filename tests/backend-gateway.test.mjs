import test from 'node:test';
import assert from 'node:assert/strict';
import { backendGateway } from '../server/backend-gateway.mjs';
async function run(path, overrides = {}) {
  const calls = [];
  const req = { method:'GET', headers:{host:'localhost:5500'}, query:{path}, ...overrides.req };
  const res = { setHeader(){}, status(code){this.code=code;return this;},json(data){this.data=data;} };
  await backendGateway(req,res,{env:{IOT_API_BASE:'https://iot.example',IOT_API_KEY:'server-secret'},fetcher:async(url,options)=>{calls.push({url:String(url),options});return {ok:true,status:200,json:async()=>({nombre:'Vehículo de prueba'})};},...overrides.dependencies});
  return {res,calls};
}
test('lecturas públicas se reenvían sin inyectar la clave privada',async()=>{
  for (const path of ['/','/vehiculos','/vehiculos/1','/vehiculos/1/comandos','/vehiculos/1/demos','/vehiculos/1/estado','/vehiculos/1/historial']) {
    const {res,calls}=await run(path);assert.equal(res.code,200);assert.equal(calls[0].url,'https://iot.example'+path);assert.equal(calls[0].options.headers['X-API-Key'],undefined);assert.equal(res.data.nombre,'Vehículo de prueba');
  }
});
test('rechaza URLs externas, traversal, parámetros y rutas de control',async()=>{
  for (const path of ['https://evil.example','//evil.example','/vehiculos/../docs','/vehiculos/1/mover','/docs','/vehiculos/1?secret=x',undefined,['/vehiculos']]) {
    const {res,calls}=await run(path);assert.equal(res.code,400);assert.equal(calls.length,0);
  }
});
test('la administración no utiliza la clave privada de control',async()=>{
  const {res,calls}=await run('/vehiculos/1',{req:{method:'DELETE'}});assert.equal(res.code,401);assert.equal(calls.length,0);
});
test('administración reenvía solo la clave proporcionada por el administrador',async()=>{
  const {res,calls}=await run('/vehiculos/1/comandos',{req:{method:'POST',headers:{host:'localhost:5500','x-api-key':'admin-test'},body:{nombre:'PRUEBA',codigo:2}}});
  assert.equal(res.code,200);assert.equal(calls[0].options.headers['X-API-Key'],'admin-test');assert.deepEqual(JSON.parse(calls[0].options.body),{nombre:'PRUEBA',codigo:2});
});
test('no habilita movimientos mediante el proxy administrativo',async()=>{
  const {res,calls}=await run('/vehiculos/1/mover',{req:{method:'POST',headers:{'x-api-key':'admin-test'}}});assert.equal(res.code,400);assert.equal(calls.length,0);
});
test('rechaza un origen externo antes de conectarse a EC2',async()=>{
  const {res,calls}=await run('/vehiculos',{req:{headers:{host:'localhost:5500',origin:'https://evil.example'}}});assert.equal(res.code,403);assert.equal(calls.length,0);
});
