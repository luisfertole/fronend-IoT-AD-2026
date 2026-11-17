import { conexionESP } from '../../shared/device-status.js';
export class EstadoESP {
  constructor(paint, client) { this.paint=paint;this.client=client;this.revision=0;this.busy=false;this.connected=null; }
  set(value) { this.connected=value;this.paint(value); }
  async refresh() {
    if(this.busy)return;this.busy=true;const revision=this.revision;
    try { const state=await this.client.dispositivo();if(revision===this.revision)this.set(conexionESP(state)); }
    catch {if(revision===this.revision)this.set(null);}
    finally {this.busy=false;}
  }
  event(message) {
    if(message.tipo==='DISPOSITIVO_CONECTADO'){this.revision++;this.set(true);}
    if(message.tipo==='DISPOSITIVO_DESCONECTADO'){this.revision++;this.set(false);}
    if(message.tipo==='ESTADO_DISPOSITIVO'){
      const value=conexionESP(message.dispositivo || message.estado || message);
      if(value!==null){this.revision++;this.set(value);}
    }
  }
}
