import test from 'node:test';import assert from 'node:assert/strict';
import {Controlador} from '../src/features/control/controller.js';
import {executeIntent} from '../src/features/voice/executor.js';
import {validIntent,buildIntentTool,MOVEMENTS,FUNCTIONS} from '../src/features/voice/contract.js';
import {loadVoiceDemos} from '../server/voice-catalog.mjs';
import {voiceGateway} from '../server/voice-gateway.mjs';
const move=(command='AVANZAR',duration_ms=1000)=>({kind:'move',command,enabled:false,duration_ms,reply:'Movimiento.'});
const power=enabled=>({kind:'function',command:'ENCENDER_APAGAR',enabled,duration_ms:0,reply:'Estado de placa.'});
const demo={kind:'demo',demo_id:1,reply:'Demo de maniobra.'};
const demos=[{id_demo:1,nombre:'Demo de maniobra',activo:1}];
const sequence=(steps)=>({kind:'sequence',steps,reply:'Secuencia solicitada.'});
function fixture({blocking=false,fail=false}={}){
 let clock=0;const calls=[],waits=[];const names=[...MOVEMENTS,...FUNCTIONS];
 const ctl=new Controlador({now:()=>clock,schedule:()=>0,client:{
  mover:async(id,duration)=>{calls.push({name:names[id-1],duration,at:clock});if(fail)throw Error('Sin conexión');if(blocking)clock+=duration;},
  detener:async()=>calls.push({name:'STOP',at:clock}),ejecutarDemo:async id=>calls.push({name:'DEMO',id}),cancelarDemo:async()=>calls.push({name:'CANCEL'})
 }});names.forEach((name,i)=>ctl.catalogo.set(name,{id_comando:i+1}));
 const options={demos,now:()=>clock,wait:async(ms,check)=>{check();waits.push(ms);clock+=ms;check();}};
 return {ctl,calls,waits,options,advance:ms=>{clock+=ms;}};
}
test('encadena movimientos en orden y confirma STOP antes del siguiente',async()=>{
 const {ctl,calls,options}=fixture();await executeIntent(ctl,sequence([move(),move('GIRAR_DERECHA',500)]),()=>true,options);
 assert.deepEqual(calls.map(c=>[c.name,c.at]),[['AVANZAR',0],['STOP',1000],['GIRAR_DERECHA',1000],['STOP',1500]]);assert.equal(ctl.ocupado,false);
});
test('si EC2 espera la duración no se espera el doble',async()=>{
 const {ctl,calls,options,waits}=fixture({blocking:true});await executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>true,options);
 assert.deepEqual(waits,[0,0]);assert.equal(calls.find(c=>c.name==='RETROCEDER').at,1000);
});
test('dos movimientos consecutivos iguales generan dos órdenes distintas',async()=>{
 const {ctl,calls,options}=fixture();await executeIntent(ctl,sequence([move(),move()]),()=>true,options);assert.equal(calls.filter(c=>c.name==='AVANZAR').length,2);
});
test('DETENER descarta todos los pasos restantes',async()=>{
 const {ctl,calls,options}=fixture();options.wait=async()=>{await ctl.detener();};
 await assert.rejects(()=>executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>true,options),/canceló/);assert.equal(calls.some(c=>c.name==='RETROCEDER'),false);
});
test('una función manual cancela la secuencia sin detener la acción nueva',async()=>{
 const {ctl,calls,options}=fixture();options.wait=async()=>{await ctl.iniciar('SONIDO');};
 await assert.rejects(()=>executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>true,options),/canceló/);
 assert.equal(calls.at(-1).name,'SONIDO');assert.equal(calls.some(c=>c.name==='RETROCEDER'),false);
});
test('cerrar el panel aborta una secuencia en marcha y envía STOP',async()=>{
 const {ctl,calls,options}=fixture();const abort=new AbortController();options.signal=abort.signal;options.wait=async()=>abort.abort();
 await assert.rejects(()=>executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>true,options),/canceló/);assert.equal(calls.at(-1).name,'STOP');assert.equal(calls.some(c=>c.name==='RETROCEDER'),false);
});
test('una desconexión cancela los pasos que faltan',async()=>{
 const {ctl,calls,options}=fixture();let connected=true;options.wait=async()=>{connected=false;};
 await assert.rejects(()=>executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>connected,options),/dejó de estar conectada/);assert.equal(calls.at(-1).name,'STOP');assert.equal(calls.some(c=>c.name==='RETROCEDER'),false);
});
test('valida todos los pasos antes de ejecutar el primero',async()=>{
 const {ctl,calls,options}=fixture();ctl.catalogo.delete('RETROCEDER');
 await assert.rejects(()=>executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>true,options),/no está disponible/);assert.deepEqual(calls,[]);
});
test('un fallo de la API no continúa con el movimiento siguiente',async()=>{
 const {ctl,calls,options}=fixture({fail:true});await assert.rejects(()=>executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>true,options),/no aceptó/);assert.equal(calls.some(c=>c.name==='RETROCEDER'),false);
});
test('encender y apagar placa reutiliza el botón y no repite el estado seleccionado',async()=>{
 const {ctl,calls,options}=fixture();await executeIntent(ctl,power(true),()=>true,options);await executeIntent(ctl,power(true),()=>true,options);await executeIntent(ctl,power(false),()=>true,options);
 assert.equal(calls.filter(c=>c.name==='ENCENDER_APAGAR').length,2);assert.deepEqual(ctl.funciones,{encendido:false,sonido:false,luces:false});
});
test('ejecuta únicamente demos que siguen disponibles en la consola',async()=>{
 const {ctl,calls,options}=fixture();await executeIntent(ctl,demo,()=>true,options);assert.deepEqual(calls,[{name:'DEMO',id:1}]);assert.equal(ctl.demo,true);
 const other=fixture();await assert.rejects(()=>executeIntent(other.ctl,demo,()=>true,{demos:[]}),/ya no está disponible/);assert.deepEqual(other.calls,[]);
});
test('una demo puede cerrar la secuencia y su cancelación funciona sin ESP verificada',async()=>{
 const {ctl,calls,options}=fixture();await executeIntent(ctl,sequence([move(),demo]),()=>true,options);assert.equal(calls.at(-1).name,'DEMO');
 await executeIntent(ctl,{kind:'cancel_demo',reply:'Cancelar.'},()=>false);assert.equal(calls.at(-1).name,'CANCEL');assert.equal(ctl.demo,false);
});
test('rechaza secuencias largas, anidadas o con pasos después de una demo',()=>{
 assert.equal(validIntent(sequence(Array.from({length:7},()=>move()))),false);assert.equal(validIntent(sequence([demo,move()])),false);assert.equal(validIntent(sequence([sequence([move(),move()]),move()])),false);assert.equal(validIntent(sequence([move('AVANZAR',5001),move()])),false);
});
test('el esquema de demos enumera solo identificadores activos del catálogo',()=>{
 const tool=buildIntentTool([...demos,{id_demo:2,nombre:'Inactiva',activo:0}]);const branch=tool.parameters.properties.intent.anyOf.find(s=>s.properties.kind.enum[0]==='demo');assert.deepEqual(branch.properties.demo_id.enum,[1]);
});
test('catálogo de voz solo consulta GET y no envía credenciales IoT',async()=>{
 const requests=[];const data=await loadVoiceDemos({env:{IOT_API_KEY:'iot-private-secret',IOT_VEHICLE_ID:'3'},fetcher:async(url,request)=>{requests.push({url:String(url),request});return {ok:true,json:async()=>demos};}});
 assert.equal(data.length,1);assert.equal(requests[0].url,'https://iot-vehiculos.duckdns.org/vehiculos/3/demos');assert.equal(requests[0].request.method,'GET');assert.equal(JSON.stringify(requests).includes('iot-private-secret'),false);
});
test('fallos o configuración inválida del catálogo no inventan demos',async()=>{
 assert.deepEqual(await loadVoiceDemos({env:{IOT_API_BASE:'file:///tmp'},fetcher:()=>assert.fail('No debe consultar')}),[]);
 assert.deepEqual(await loadVoiceDemos({env:{},fetcher:async()=>({ok:false})}),[]);
});
test('el gateway limita la demo al catálogo y comunica la selección al modelo',async()=>{
 const requests=[];const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 await voiceGateway({method:'POST',headers:{host:'localhost'},body:{text:'ejecuta la demo seleccionada',selected_demo_id:1}},res,{env:{OPENAI_API_KEY:'openai-test-secret'},limit:()=>true,getDemos:async()=>demos,fetcher:async(url,request)=>{requests.push(JSON.parse(request.body));return {ok:true,json:async()=>({output:[{type:'function_call',name:'interpret_vehicle_intent',arguments:JSON.stringify({intent:demo})}]})};}});
 assert.equal(res.code,200);assert.deepEqual(res.data.intent,demo);assert.ok(requests[0].instructions.includes('"selected_demo_id":1'));
});
test('un identificador de demo inventado se rechaza aunque el modelo lo devuelva',async()=>{
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 await voiceGateway({method:'POST',headers:{host:'localhost'},body:{text:'ejecuta demo 99'}},res,{env:{OPENAI_API_KEY:'test'},limit:()=>true,getDemos:async()=>demos,fetcher:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'interpret_vehicle_intent',arguments:JSON.stringify({intent:{...demo,demo_id:99}})}]})})});assert.equal(res.code,422);assert.equal(res.data.code,'demo_missing');
});

test('un fallo al iniciar una demo solicita una parada para no dejar ejecución incierta',async()=>{
 const {ctl,calls}=fixture();ctl.api.ejecutarDemo=async()=>{throw Error('Timeout');};
 await assert.rejects(()=>executeIntent(ctl,demo,()=>true,{demos}),/no aceptó la demo/);assert.equal(calls.at(-1).name,'STOP');
});

test('una orden manual mientras se confirma STOP impide el siguiente paso',async()=>{
 const {ctl,calls,options}=fixture();let release,entered;const pending=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 ctl.api.detener=async()=>{calls.push({name:'STOP'});entered();await pending;};
 const job=executeIntent(ctl,sequence([move(),move('RETROCEDER')]),()=>true,options);await started;
 const manual=ctl.iniciar('LUCES');release();await assert.rejects(()=>job,/canceló/);await manual;
 assert.equal(calls.some(c=>c.name==='RETROCEDER'),false);assert.equal(calls.at(-1).name,'LUCES');
});
