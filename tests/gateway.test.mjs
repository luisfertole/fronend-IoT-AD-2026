import test from 'node:test';
import assert from 'node:assert/strict';
import { controlGateway } from '../server/control-gateway.mjs';
const env={IOT_API_KEY:'test-only-key',IOT_VEHICLE_ID:'1',IOT_API_BASE:'https://iot.example'};
async function run(body, overrides={}) {
  let calls=[];
  const req={method:'POST',headers:{host:'localhost:5500',origin:'http://localhost:5500'},body,...overrides.req};
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;}};
  await controlGateway(req,res,{env:overrides.env || env,fetcher:async(url,options)=>{calls.push({url:String(url),options});return {ok:true,status:200};},...overrides.dependencies});
  return {res,calls};
}
test('envía la clave solamente del servidor al backend y fija el vehículo',async()=>{
  const {res,calls}=await run({action:'mover',id_comando:4,duracion_ms:5000,vehicle:99});
  assert.equal(res.code,200); assert.equal(calls[0].url,'https://iot.example/vehiculos/1/mover?id_comando=4&duracion_ms=5000');
  assert.equal(calls[0].options.headers['X-API-Key'],env.IOT_API_KEY);
  assert.equal(JSON.stringify(res.data).includes(env.IOT_API_KEY),false);
});
test('rechaza rutas administrativas y duraciones inválidas sin llamar al backend',async()=>{
  for(const body of [{action:'borrar',path:'/vehiculos/1'},{action:'mover',id_comando:1,duracion_ms:5001},{action:'mover',id_comando:'1',duracion_ms:1},{action:'demo',id_demo:0}]){
    const {res,calls}=await run(body); assert.ok(res.code>=400); assert.equal(calls.length,0);
  }
});
test('sin clave devuelve un error de configuración claro',async()=>{
  const {res,calls}=await run({action:'detener'},{env:{}}); assert.equal(res.code,503);assert.equal(calls.length,0);
});
test('el texto tu_clave del ejemplo no cuenta como una clave configurada',async()=>{
  const {res,calls}=await run({action:'detener'},{env:{IOT_API_KEY:'tu_clave'}});assert.equal(res.code,503);assert.equal(calls.length,0);
  const status=await run(undefined,{req:{method:'GET'},env:{IOT_API_KEY:'tu_clave'}});assert.equal(status.res.data.ready,false);
});
test('rechaza origen externo',async()=>{
  const {res,calls}=await run({action:'detener'},{req:{headers:{host:'localhost:5500',origin:'https://other.example'}}});assert.equal(res.code,403);assert.equal(calls.length,0);
});
test('no filtra respuestas arbitrarias o claves del backend',async()=>{
  const {res}=await run({action:'detener'},{dependencies:{fetcher:async()=>({ok:false,status:500,json:async()=>({detail:env.IOT_API_KEY})})}});
  assert.equal(res.code,500);assert.equal(JSON.stringify(res.data).includes(env.IOT_API_KEY),false);
});
test('informa disponibilidad sin revelar la clave',async()=>{
  const {res,calls}=await run(undefined,{req:{method:'GET'}});assert.equal(res.data.ready,true);assert.equal(calls.length,0);assert.equal(JSON.stringify(res.data).includes(env.IOT_API_KEY),false);
});
