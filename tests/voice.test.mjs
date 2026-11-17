import test from 'node:test';import assert from 'node:assert/strict';
import { voiceGateway } from '../server/voice-gateway.mjs';
import { executeIntent } from '../src/features/voice/executor.js';
import { validIntent,isStop,intentTool } from '../src/features/voice/contract.js';
import { Controlador } from '../src/features/control/controller.js';
const intent={kind:'move',command:'AVANZAR',enabled:false,duration_ms:2000,reply:'Avanzar dos segundos.'};
async function run(body,options={}){const calls=[];const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};await voiceGateway({method:'POST',headers:{host:'localhost',origin:'http://localhost'},body,...options.req},res,{env:{OPENAI_API_KEY:'openai-test-secret'},limit:()=>true,getDemos:async()=>[],fetcher:async(url,request)=>{calls.push({url,request});if(String(url).endsWith('/transcriptions'))return {ok:true,json:async()=>({text:'avanza dos segundos'})};return {ok:true,json:async()=>({status:'completed',output:[{type:'function_call',name:intentTool.name,arguments:JSON.stringify({intent})}]})};},...options.dependencies});return {res,calls};}
test('interpreta una orden con function calling y no llama a EC2',async()=>{const {res,calls}=await run({text:'avanza dos segundos'});assert.equal(res.code,200);assert.deepEqual(res.data.intent,intent);assert.ok(calls.every(c=>c.url.startsWith('https://api.openai.com/v1/')));const request=JSON.parse(calls[0].request.body);assert.equal(request.store,false);assert.equal(request.parallel_tool_calls,false);assert.equal(request.tool_choice.name,intentTool.name);assert.equal(JSON.stringify(res.data).includes('openai-test-secret'),false);});
test('transcribe audio antes de interpretar la intención',async()=>{const {res,calls}=await run({audio:Buffer.from('audio simulado').toString('base64'),mime:'audio/webm'});assert.equal(res.code,200);assert.equal(calls.length,2);assert.ok(calls[0].request.body instanceof FormData);assert.equal(calls[0].request.body.get('model'),'gpt-transcribe');assert.equal(calls[0].request.body.get('languages[]'),'es');assert.equal(calls[0].request.body.has('language'),false);});
test('sin clave devuelve configuración pendiente, nunca expone valores',async()=>{const {res,calls}=await run({text:'avanza'},{dependencies:{env:{}}});assert.equal(res.code,503);assert.equal(calls.length,0);});
test('alto evita esperar la interpretación del modelo',async()=>{const {res,calls}=await run({text:'alto'});assert.equal(res.data.intent.kind,'stop');assert.equal(calls.length,0);assert.equal(isStop('no te detengas'),false);});
test('rechaza audio inválido, tipos desconocidos y texto excesivo',async()=>{for(const body of [{audio:'%%%%',mime:'audio/webm'},{audio:'YQ==',mime:'text/html'},{text:'x'.repeat(601)},{text:'hola',audio:'YQ==',mime:'audio/webm'}]){const {res,calls}=await run(body);assert.ok(res.code>=400);assert.equal(calls.length,0);}});
test('orígenes externos y exceso de solicitudes se rechazan antes de OpenAI',async()=>{const cross=await run({text:'avanza'},{req:{headers:{host:'localhost',origin:'https://other.example'}}});assert.equal(cross.res.code,403);assert.equal(cross.calls.length,0);const rate=await run({text:'avanza'},{dependencies:{limit:()=>false}});assert.equal(rate.res.code,429);});
test('el modelo no puede elegir rutas, duraciones ilimitadas ni una función como movimiento',()=>{assert.equal(validIntent({...intent,command:'/vehiculos/1/mover'}),false);assert.equal(validIntent({...intent,duration_ms:5001}),false);assert.equal(validIntent({...intent,command:'LUCES'}),false);assert.equal(validIntent({...intent,url:'https://evil.example'}),false);});
test('una respuesta del modelo inválida no genera una orden',async()=>{const {res}=await run({text:'avanza'},{dependencies:{fetcher:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:intentTool.name,arguments:JSON.stringify({intent:{...intent,duration_ms:9000}})}]})})}});assert.equal(res.code,422);});
test('ESP desconectada bloquea movimientos, pero nunca impide DETENER',async()=>{let stops=0;const ctl={detener:async()=>{stops++;return true;}};await assert.rejects(()=>executeIntent(ctl,intent,()=>false),/ESP/);await executeIntent(ctl,{kind:'stop',command:'DETENER',enabled:false,duration_ms:0,reply:'Parar'},()=>false);assert.equal(stops,1);});
test('encender luces ya encendidas no vuelve a alternar el comando',async()=>{let sent=0;const ctl={tiene:()=>true,funciones:{luces:true},iniciar:async()=>{sent++;return true;}};await executeIntent(ctl,{kind:'function',command:'LUCES',enabled:true,duration_ms:0,reply:'Encender luces'},()=>true);assert.equal(sent,0);});
test('la duración de voz no cambia el límite de los joysticks',async()=>{const sent=[];const ctl=new Controlador({client:{mover:async(id,ms)=>sent.push(ms),detener:async()=>{}},schedule:()=>0});ctl.catalogo.set('AVANZAR',{id_comando:1});await executeIntent(ctl,intent,()=>true);await ctl.detener();await ctl.iniciar('AVANZAR');assert.deepEqual(sent,[2000,5000]);});

test('una orden manual nueva invalida la voz que esperaba una parada',async()=>{
  let release;const pending=new Promise(r=>release=r);const sent=[];
  const ctl=new Controlador({client:{mover:async id=>sent.push(id),detener:()=>pending},schedule:()=>0});
  ctl.catalogo.set('AVANZAR',{id_comando:1});ctl.catalogo.set('LUCES',{id_comando:2});
  const stopping=ctl.detener();const voice=executeIntent(ctl,intent,()=>true);
  await Promise.resolve();await Promise.resolve();const manual=ctl.iniciar('LUCES');release();
  await assert.rejects(()=>voice,/no aceptó/);await Promise.all([stopping,manual]);assert.deepEqual(sent,[2]);
});
test('DETENER cancela una orden de voz pendiente sin reactivarla al responder',async()=>{
  let release;const pending=new Promise(r=>release=r);const sent=[];
  const ctl=new Controlador({client:{mover:async id=>sent.push(id),detener:()=>pending},schedule:()=>0});ctl.catalogo.set('AVANZAR',{id_comando:1});
  const a=ctl.detener();const voice=executeIntent(ctl,intent,()=>true);const b=ctl.detener();release();
  await assert.rejects(()=>voice,/no aceptó/);await Promise.all([a,b]);assert.deepEqual(sent,[]);
});
test('un error de OpenAI se informa sin reproducir su respuesta o credenciales',async()=>{
  const {res}=await run({text:'avanza'},{dependencies:{fetcher:async()=>({ok:false,status:401,json:async()=>({error:'openai-test-secret'})})}});
  assert.equal(res.code,502);assert.equal(JSON.stringify(res.data).includes('openai-test-secret'),false);
});

test('rechaza un estado de interruptor incompatible con un movimiento',async()=>{
  const modelIntent={...intent,enabled:true};
  const {res}=await run({text:'avanza dos segundos'},{dependencies:{fetcher:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:intentTool.name,arguments:JSON.stringify({intent:modelIntent})}]})})}});
  assert.equal(res.code,422);assert.equal(res.data.code,'intent_invalid');assert.equal(res.data.transcript,'avanza dos segundos');
});
test('conserva la validación de tipos, campos y límites',async()=>{
  for(const modelIntent of [{...intent,enabled:'true'},{...intent,enabled:true,duration_ms:9000},{...intent,enabled:true,url:'https://example.com'}]){
    const {res}=await run({text:'avanza'},{dependencies:{fetcher:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:intentTool.name,arguments:JSON.stringify({intent:modelIntent})}]})})}});
    assert.equal(res.code,422);
  }
});

test('el esquema vincula cada clase de orden a sus comandos y duraciones',()=>{
  const variants=intentTool.parameters.properties.intent.anyOf;
  assert.deepEqual(intentTool.parameters.required,['intent']);
  const movement=variants.find(v=>v.properties.kind.enum[0]==='move');
  const toggle=variants.find(v=>v.properties.kind.enum[0]==='function');
  assert.equal(movement.properties.command.enum.includes('SONIDO'),false);
  assert.equal(toggle.properties.command.enum.includes('SONIDO'),true);
  assert.deepEqual(toggle.properties.duration_ms.enum,[0]);
});
test('un error de interpretación conserva la transcripción para el panel',async()=>{
  const {res}=await run({text:'encender sonido'},{dependencies:{fetcher:async()=>({ok:true,json:async()=>({output:[]})})}});
  assert.equal(res.code,422);assert.equal(res.data.code,'intent_missing');assert.equal(res.data.transcript,'encender sonido');
});
test('audio incorrecto tiene un diagnóstico específico antes de consultar OpenAI',async()=>{
  const {res,calls}=await run({audio:'%%%%',mime:'audio/webm'});
  assert.equal(res.code,422);assert.equal(res.data.code,'audio_invalid');assert.equal(calls.length,0);
});

test('una transcripción vacía no llega al intérprete ni ejecuta una orden',async()=>{
  const {res,calls}=await run({audio:'YQ==',mime:'audio/webm'},{dependencies:{fetcher:async()=>({ok:true,json:async()=>({text:''})})}});
  assert.equal(res.code,422);assert.equal(res.data.code,'transcript_empty');assert.equal(Object.hasOwn(res.data,'intent'),false);
});
test('modelos anteriores usan language en lugar de languages',async()=>{
  const {res,calls}=await run({audio:'YQ==',mime:'audio/webm'},{dependencies:{env:{OPENAI_API_KEY:'openai-test-secret',OPENAI_TRANSCRIBE_MODEL:'whisper-1'}}});
  assert.equal(res.code,200);assert.equal(calls[0].request.body.get('language'),'es');assert.equal(calls[0].request.body.has('languages[]'),false);
});
