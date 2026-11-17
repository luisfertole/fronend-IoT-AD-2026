import {TiltControl} from './tilt-control.js';
export function mountGyroscope(ctl,{canMove,onEnable=()=>{},notify=()=>{}}={}){
 const button=document.getElementById('gyro-toggle'),hint=document.getElementById('gyro-state'),bar=document.getElementById('gyro-controls');
 const joy=document.getElementById('joy'),knob=joy.querySelector('.joystick-knob');
 const mobile=navigator.maxTouchPoints>0||matchMedia('(any-pointer:coarse)').matches;bar.hidden=!mobile;
 let operation=0,pending=false,hadControl=false;
 const mode=new TiltControl(ctl,{canMove,now:()=>ctl.now(),paint:state=>{
   if(!state.enabled)window.removeEventListener('deviceorientation',sensor);
   button.setAttribute('aria-pressed',String(state.enabled));button.classList.toggle('is-on',state.enabled);button.textContent=state.enabled?'Desactivar giroscopio':'Activar giroscopio';hint.textContent=state.message;
   if(state.enabled||hadControl){
     joy.dataset.direction=state.direction||'';document.getElementById('joy-status').textContent=state.direction?state.message.toUpperCase():'EN REPOSO';
     const xy={arriba:[0,-22],abajo:[0,22],izquierda:[-22,0],derecha:[22,0]}[state.direction];knob.style.transform=xy?'translate('+xy[0]+'px,'+xy[1]+'px)':'';
     document.querySelectorAll('[data-joystick="joy"]').forEach(el=>el.classList.toggle('selected',el.dataset.direction===state.direction));
   }hadControl=state.enabled;
 }});
 function disable(message,options){operation++;pending=false;button.disabled=false;mode.disable(message,options);}
 const sensor=event=>mode.sample(event.beta,event.gamma,screen.orientation?.angle??window.orientation??0);
 const watch=setInterval(()=>mode.tick(),150);watch?.unref?.();
 button.addEventListener('click',async()=>{
   if(mode.enabled||pending){disable();return;}
   const id=++operation;
   try{
     if(!window.isSecureContext)throw Error('Abre la página mediante HTTPS para usar el giroscopio.');
     const Orientation=window.DeviceOrientationEvent;if(!Orientation)throw Error('Este navegador no ofrece control por giroscopio.');
     if(!canMove()||ctl.demo||ctl.demoPendiente)throw Error('Conecta la ESP y detén la demo antes de activar el giroscopio.');
     pending=true;button.disabled=true;hint.textContent='Solicitando acceso a movimiento…';
     if(typeof Orientation.requestPermission==='function'){const result=await Orientation.requestPermission();if(id!==operation)return;if(result!=='granted')throw Error('No se autorizó el sensor. Permite el acceso a movimiento y orientación.');}
     if(id!==operation)return;onEnable();if(await mode.enable()&&id===operation)window.addEventListener('deviceorientation',sensor);
   }catch(error){if(id===operation){mode.disable(error.message);notify('error',error.message);}}
   finally{if(id===operation){pending=false;button.disabled=false;}}
 });
 const manual=event=>{
   if(event.type==='keydown'&&!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(event.key))return;
   if((mode.enabled||pending)&&event.target.closest?.('#joy,#joy2,#power,#sound,#lights,#demo-run,#demo-cancel,#voice-open,#detener,#reload'))disable('Giroscopio desactivado: control manual.');
 };
 document.addEventListener('pointerdown',manual,true);document.addEventListener('keydown',manual,true);document.addEventListener('click',manual,true);
 const suspend=()=>{if(mode.enabled||pending)disable('Giroscopio desactivado al salir de Control.');};
 window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
 const rotated=()=>{if(mode.enabled||pending)disable('Pantalla girada. Activa de nuevo para recalibrar.');};
 screen.orientation?.addEventListener?.('change',rotated);window.addEventListener('orientationchange',rotated);
 return {disable,mode};
}
