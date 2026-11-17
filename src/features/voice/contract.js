export const MOVEMENTS=['AVANZAR','RETROCEDER','IZQUIERDA','DERECHA','LEVANTAR','BAJAR','GIRAR_IZQUIERDA','GIRAR_DERECHA'];
export const FUNCTIONS=['ENCENDER_APAGAR','SONIDO','LUCES'];
export const VOICE_COMMANDS=[...MOVEMENTS,...FUNCTIONS,'DETENER','NINGUNO'];
export const MAX_VOICE_STEPS=6;
export const MAX_RECORDING_SECONDS=15;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const replyOK=value=>typeof value==='string'&&value.length<=240;
export function activeDemos(values){
  if(!Array.isArray(values))return [];
  const found=new Set();
  return values.filter(value=>value&&Number.isSafeInteger(Number(value.id_demo))&&Number(value.id_demo)>0&&value.activo!==false&&value.activo!==0&&value.activo!=='0').flatMap(value=>{
    const id_demo=Number(value.id_demo);if(found.has(id_demo))return [];found.add(id_demo);
    return [{id_demo,nombre:String(value.nombre||'Demo '+id_demo).trim().slice(0,120),activo:true}];
  }).slice(0,50);
}
export function validAction(value){
  if(exact(value,['kind','demo_id','reply']))return value.kind==='demo'&&Number.isSafeInteger(value.demo_id)&&value.demo_id>0&&replyOK(value.reply);
  if(exact(value,['kind','reply']))return value.kind==='cancel_demo'&&replyOK(value.reply);
  if(!exact(value,['kind','command','enabled','duration_ms','reply'])||!replyOK(value.reply)||typeof value.enabled!=='boolean'||!Number.isInteger(value.duration_ms))return false;
  if(value.kind==='move')return MOVEMENTS.includes(value.command)&&value.duration_ms>=50&&value.duration_ms<=5000&&value.enabled===false;
  if(value.kind==='function')return FUNCTIONS.includes(value.command)&&value.duration_ms===0;
  if(value.kind==='stop')return value.command==='DETENER'&&value.duration_ms===0&&value.enabled===false;
  if(value.kind==='none')return value.command==='NINGUNO'&&value.duration_ms===0&&value.enabled===false;
  return false;
}
export function validIntent(value){
  if(value?.kind!=='sequence')return validAction(value);
  if(!exact(value,['kind','steps','reply'])||!replyOK(value.reply)||!Array.isArray(value.steps)||value.steps.length<2||value.steps.length>MAX_VOICE_STEPS)return false;
  return value.steps.every((step,index)=>validAction(step)&&['move','function','stop','demo'].includes(step.kind)&&(!['stop','demo'].includes(step.kind)||index===value.steps.length-1));
}
export const intentSteps=value=>value.kind==='sequence'?value.steps:[value];
export function describeAction(value,demos=[]){
  if(value.kind==='demo')return 'Ejecutar '+(demos.find(d=>Number(d.id_demo)===value.demo_id)?.nombre||'demo '+value.demo_id);
  if(value.kind==='cancel_demo')return 'Cancelar demo';
  if(value.kind==='stop')return 'Detener';
  if(value.kind==='function')return (value.enabled?'Encender ':'Apagar ')+({ENCENDER_APAGAR:'placa',SONIDO:'sonido',LUCES:'luces'}[value.command]||'función');
  if(value.kind==='none')return value.reply;
  const names={AVANZAR:'Avanzar',RETROCEDER:'Retroceder',IZQUIERDA:'Mover a la izquierda',DERECHA:'Mover a la derecha',LEVANTAR:'Levantar pala',BAJAR:'Bajar pala',GIRAR_IZQUIERDA:'Rotar a la izquierda',GIRAR_DERECHA:'Rotar a la derecha'};
  return names[value.command]+' · '+(value.duration_ms/1000)+' s';
}
export function isStop(text){return /^(?:(?:por favor|oye)\s+)?(?:alto|para|parar|detente|detener|frena|emergencia|deten el vehiculo|para el vehiculo)(?:\s+por favor)?[.!]*$/i.test(String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim());}
export function stopIntent(){return {kind:'stop',command:'DETENER',enabled:false,duration_ms:0,reply:'Parada solicitada.'};}
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const reply={type:'string',maxLength:240};
function variant(kind,commands,duration,enabled={type:'boolean',enum:[false]}){return object({kind:{type:'string',enum:[kind]},command:{type:'string',enum:commands},enabled,duration_ms:duration,reply});}
export function buildIntentTool(demos=[]){
  const actions=[variant('move',MOVEMENTS,{type:'integer',minimum:50,maximum:5000}),variant('function',FUNCTIONS,{type:'integer',enum:[0]},{type:'boolean'}),variant('stop',['DETENER'],{type:'integer',enum:[0]})];
  const ids=activeDemos(demos).map(demo=>demo.id_demo);
  if(ids.length)actions.push(object({kind:{type:'string',enum:['demo']},demo_id:{type:'integer',enum:ids},reply}));
  return {type:'function',name:'interpret_vehicle_intent',description:'Interpreta acciones ordenadas, demos guardadas o una parada. No ejecuta el vehículo.',strict:true,parameters:object({intent:{anyOf:[...actions,object({kind:{type:'string',enum:['cancel_demo']},reply}),variant('none',['NINGUNO'],{type:'integer',enum:[0]}),object({kind:{type:'string',enum:['sequence']},steps:{type:'array',minItems:2,maxItems:MAX_VOICE_STEPS,items:{anyOf:actions}},reply})]}})};
}
export const intentTool=buildIntentTool();
