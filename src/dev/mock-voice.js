import { isStop,stopIntent,validIntent,activeDemos,MAX_VOICE_STEPS } from '../features/voice/contract.js';
export function mockIntent(input,{demos=[],selectedDemo=null}={}){
 const text=String(input).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(isStop(text))return stopIntent();
 const empty={kind:'none',command:'NINGUNO',enabled:false,duration_ms:0,reply:'Simulación: especifica acciones de hasta cinco segundos o una demo guardada.'};
 function action(value){
  if(isStop(value))return stopIntent();
  if(/^no /.test(value))return empty;
  if(/demo/.test(value)){
   if(/cancel|deten|para/.test(value))return {kind:'cancel_demo',reply:'Cancelar demo simulada.'};
   const catalog=activeDemos(demos),number=value.match(/demo\s+(\d+)/)?.[1];
   const found=/seleccionad/.test(value)?catalog.find(d=>d.id_demo===Number(selectedDemo)):number?catalog.find(d=>d.id_demo===Number(number)):catalog.find(d=>value.includes(d.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))||(catalog.length===1?catalog[0]:null);
   return found?{kind:'demo',demo_id:found.id_demo,reply:'Ejecutar demo simulada.'}:empty;
  }
  if(/luces|sonido|placa|tarjeta|vehiculo|equipo|esp(?:8266)?/.test(value)){
   if(!/enciend|encender|activ|apaga|desactiv/.test(value))return empty;
   return {kind:'function',command:/luces/.test(value)?'LUCES':/sonido/.test(value)?'SONIDO':'ENCENDER_APAGAR',enabled:!/apaga|desactiv/.test(value),duration_ms:0,reply:'Cambiar estado en la simulación.'};
  }
  const command=/avanz|adelante/.test(value)?'AVANZAR':/retroced|atras/.test(value)?'RETROCEDER':/levant/.test(value)?'LEVANTAR':/baj/.test(value)?'BAJAR':/rot|gir/.test(value)?(/izquierda/.test(value)?'GIRAR_IZQUIERDA':'GIRAR_DERECHA'):/izquierda/.test(value)?'IZQUIERDA':/derecha/.test(value)?'DERECHA':null;
  if(!command)return empty;
  const number=value.match(/(\d+(?:[.,]\d+)?)\s*(milisegundos?|ms|segundos?|s)\b/);
  const word=value.match(/\b(un|uno|una|dos|tres|cuatro|cinco)\s+segundos?\b/)?.[1];
  const duration_ms=number?Number(number[1].replace(',','.'))*(/^(ms|milisegundo)/.test(number[2])?1:1000):word?({un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5}[word]*1000):1000;
  const result={kind:'move',command,enabled:false,duration_ms,reply:'Movimiento solicitado en la simulación.'};return validIntent(result)?result:empty;
 }
 const parts=text.split(/\s+(?:y(?:\s+(?:luego|despues))?|luego|despues)\s+|;\s*/).filter(Boolean);
 if(parts.length===1)return action(text);
 if(parts.length>MAX_VOICE_STEPS)return empty;
 const steps=parts.map(action),result={kind:'sequence',steps,reply:'Secuencia solicitada en la simulación.'};return validIntent(result)?result:empty;
}
