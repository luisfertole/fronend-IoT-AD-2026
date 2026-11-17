const COMMANDS={arriba:'AVANZAR',abajo:'RETROCEDER',izquierda:'IZQUIERDA',derecha:'DERECHA'};
const difference=(value,base)=>((value-base+540)%360)-180;
export function tiltVector(beta,gamma,base,angle=0){
  if(!Number.isFinite(beta)||!Number.isFinite(gamma)||!base)return null;
  const pitch=difference(beta,base.beta),roll=difference(gamma,base.gamma),r=angle*Math.PI/180;
  return {x:roll*Math.cos(r)+pitch*Math.sin(r),y:pitch*Math.cos(r)-roll*Math.sin(r)};
}
export function tiltDirection(vector,previous=null){
  if(!vector)return null;const {x,y}=vector,threshold=previous?7:12;
  if(Math.max(Math.abs(x),Math.abs(y))<threshold)return null;
  if(previous&&((previous==='izquierda'&&x<=-7)||(previous==='derecha'&&x>=7))&&Math.abs(y)<Math.abs(x)+4)return previous;
  if(previous&&((previous==='arriba'&&y<=-7)||(previous==='abajo'&&y>=7))&&Math.abs(x)<Math.abs(y)+4)return previous;
  return Math.abs(x)>Math.abs(y)?(x>0?'derecha':'izquierda'):(y>0?'abajo':'arriba');
}
export class TiltControl {
  constructor(ctl,{canMove=()=>true,paint=()=>{},now=()=>Date.now()}={}){this.ctl=ctl;this.canMove=canMove;this.paint=paint;this.now=now;this.enabled=false;this.version=0;this.base=null;this.direction=null;this.waitingCenter=false;}
  owns(){return this.epoch===this.ctl.paradas&&this.token===this.ctl.intencion;}
  emit(message){this.paint({enabled:this.enabled,direction:this.direction,calibrated:Boolean(this.base),waitingCenter:this.waitingCenter,message});}
  async enable(){
    const version=++this.version;
    if(!this.canMove()||this.ctl.demo||this.ctl.demoPendiente)throw Error('Conecta la ESP y detén la demo antes de activar el giroscopio.');
    const ok=await this.ctl.detener();if(version!==this.version)return false;
    if(!ok||!this.canMove())throw Error('No se confirmó la conexión y la parada del vehículo.');
    this.enabled=true;this.base=null;this.direction=null;this.waitingCenter=false;this.started=this.lastSample=this.now();this.epoch=this.ctl.paradas;this.token=this.ctl.intencion;
    this.emit('Mantén el móvil en una posición cómoda para calibrar.');return true;
  }
  disable(message='Giroscopio desactivado.',{stop=true}={}){
    const was=this.enabled;this.version++;this.enabled=false;this.base=null;this.direction=null;this.waitingCenter=false;
    if(was&&stop&&this.owns()){const stopping=this.ctl.detener();Promise.resolve(stopping).catch(()=>{});}
    this.emit(message);
  }
  sample(beta,gamma,angle=0){
    if(!this.enabled)return;
    if(!this.owns()){this.disable('Giroscopio desactivado: se utilizó otro control.',{stop:false});return;}
    if(!this.canMove()||this.ctl.demo||this.ctl.demoPendiente){this.disable('Giroscopio desactivado: revisa la conexión con la ESP.');return;}
    if(!Number.isFinite(beta)||!Number.isFinite(gamma))return;
    this.lastSample=this.now();
    if(!this.base){this.base={beta,gamma};this.angle=angle;this.emit('Calibrado. Inclina para mover; vuelve al centro para detener.');return;}
    if(angle!==this.angle){this.disable('Pantalla girada. Activa de nuevo para recalibrar.');return;}
    const vector=tiltVector(beta,gamma,this.base,angle);
    if(Math.max(Math.abs(vector.x),Math.abs(vector.y))>60){this.disable('Inclinación excesiva. Activa de nuevo en una posición cómoda.');return;}
    const next=tiltDirection(vector,this.direction);
    if(this.waitingCenter){if(Math.max(Math.abs(vector.x),Math.abs(vector.y))<7){this.waitingCenter=false;this.emit('Listo. Inclina de nuevo para continuar.');}return;}
    if(next===this.direction)return;
    this.change(next);
  }
  change(next){
    const version=++this.version;
    if(this.direction){const stopping=this.ctl.detener();Promise.resolve(stopping).catch(()=>{});this.epoch=this.ctl.paradas;this.token=this.ctl.intencion;}
    this.direction=next;
    if(!next){this.emit('En el centro · detenido.');return;}
    const command=COMMANDS[next];if(!this.ctl.tiene(command)){this.disable('El movimiento no está disponible en el vehículo.');return;}
    this.movementStarted=this.now();this.token=this.ctl.intencion+1;
    const guard=()=>this.enabled&&version===this.version&&this.owns()&&this.canMove();
    this.emit({arriba:'Adelante',abajo:'Retroceder',izquierda:'Mover a la izquierda',derecha:'Mover a la derecha'}[next]);
    Promise.resolve(this.ctl.iniciar(command,{guard,onStart:time=>{if(version===this.version)this.movementStarted=time;}})).then(ok=>{
      if(version===this.version&&this.enabled&&!ok)this.disable('No se aceptó el movimiento. Revisa la conexión.',{stop:this.owns()});
    }).catch(()=>{if(version===this.version)this.disable('Falló el control por inclinación.');});
  }
  tick(){
    if(!this.enabled)return;
    if(!this.owns()){this.disable('Giroscopio desactivado: se utilizó otro control.',{stop:false});return;}
    if(!this.canMove()||this.ctl.demo||this.ctl.demoPendiente){this.disable('Giroscopio desactivado: revisa la conexión con la ESP.');return;}
    const now=this.now();
    if(now-this.lastSample>(this.base?1500:3500)){this.disable(this.base?'Se perdieron los datos del sensor. Vuelve a activar el giroscopio.':'No se recibieron datos del sensor. Comprueba los permisos de movimiento.');return;}
    if(this.direction&&now-this.movementStarted>=5000){this.change(null);this.waitingCenter=true;this.emit('Vuelve al centro para continuar después de cinco segundos.');}
  }
}
