import { validIntent,intentSteps,activeDemos } from './contract.js';
const cancelled=()=>new Error('La secuencia se canceló porque se usó otro control o se solicitó detener.');
async function waitChecked(ms,check,now){const until=now()+ms;while(now()<until){check();await new Promise(resolve=>setTimeout(resolve,Math.min(50,Math.max(1,until-now()))));}check();}
export async function executeIntent(ctl,intent,canMove,{signal,demos=[],onProgress=()=>{},wait,now=()=>ctl.now?.()??Date.now()}={}){
  if(!validIntent(intent))throw new Error('Instrucción no válida');
  if(intent.kind==='none')return intent.reply;
  if(intent.kind==='stop'){const ok=await ctl.detener();if(!ok)throw new Error('No se confirmó DETENER');return 'DETENER enviado al servidor.';}
  if(intent.kind==='cancel_demo'){const ok=await ctl.cancelarDemo();if(!ok)throw new Error('No se confirmó la cancelación de la demo.');return 'Cancelación de demo aceptada por la API.';}
  const actions=intentSteps(intent),allowedDemos=activeDemos(demos);
  if(!canMove())throw new Error('La tarjeta ESP debe aparecer conectada para ejecutar una orden de voz.');
  if(ctl.ocupado)throw new Error('Termina el movimiento actual o pulsa DETENER antes de otra orden de voz.');
  for(const action of actions){
    if(action.kind==='demo'&&!allowedDemos.some(demo=>demo.id_demo===action.demo_id))throw new Error('La demo ya no está disponible. Recarga el catálogo de la consola.');
    if(['move','function'].includes(action.kind)&&!ctl.tiene(action.command))throw new Error('Ese comando no está disponible para este vehículo.');
  }
  let epoch=ctl.paradas,token=ctl.intencion,moving=false;
  const owns=()=>epoch===ctl.paradas&&token===ctl.intencion;
  const check=()=>{if(signal?.aborted||!owns())throw cancelled();if(!canMove())throw new Error('La ESP dejó de estar conectada; se cancelaron los pasos restantes.');};
  const pause=wait||((ms,guard)=>waitChecked(ms,guard,now));
  async function stopOwned(){
    check();const stopping=ctl.detener();epoch=ctl.paradas;token=ctl.intencion;
    const ok=await stopping;moving=false;if(!ok)throw new Error('No se confirmó la parada entre movimientos; se canceló la secuencia.');check();
  }
  try {
    for(let index=0;index<actions.length;index++){
      check();const action=actions[index];onProgress({index,total:actions.length,action,state:'running'});
      if(action.kind==='stop'){await stopOwned();}
      else if(action.kind==='demo'){
        token=ctl.intencion+1;
        const ok=await ctl.iniciarDemo(action.demo_id,{guard:()=>!signal?.aborted&&owns()&&canMove()});
        if(!ok)throw new Error('El controlador no aceptó la demo.');check();
      }else{
        const key={ENCENDER_APAGAR:'encendido',SONIDO:'sonido',LUCES:'luces'}[action.command];
        if(action.kind==='function'&&ctl.funciones[key]===action.enabled){onProgress({index,total:actions.length,action,state:'done'});continue;}
        let started=now();token=ctl.intencion+1;moving=action.kind==='move';
        const ok=await ctl.iniciar(action.command,{durationMs:action.duration_ms,guard:()=>!signal?.aborted&&owns()&&canMove(),onStart:value=>{started=value;}});
        if(!ok)throw new Error('El controlador no aceptó la orden. Revisa la conexión o la DEMO.');check();
        if(intent.kind==='sequence'&&action.kind==='move'){
          await pause(Math.max(0,started+action.duration_ms-now()),check);check();
          await stopOwned();
        }else moving=false;
      }
      onProgress({index,total:actions.length,action,state:'done'});
    }
    return intent.kind==='sequence'?'Secuencia completada: '+actions.length+' acciones aceptadas por la API.':'API aceptada: '+intent.reply;
  }catch(error){
    if(moving&&owns()){try{await ctl.detener();}catch{/* DETENER sigue disponible en la consola. */}}
    throw error;
  }
}
