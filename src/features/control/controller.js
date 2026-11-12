import { api } from '../../services/vehicle-api.js';
import { MOVE_MS, PULSE_MS } from '../../config/app.js';
import { PULSOS } from './commands.js';
import { estadoInicial, funcionesDeTelemetria } from './function-state.js';

export class Controlador {
  constructor({ client = api, notify = () => {}, onDemo = () => {}, onFunctions = () => {}, initialFunctions = {}, schedule = (fn, ms) => globalThis.setTimeout(fn, ms), unschedule = token => globalThis.clearTimeout(token), now = () => Date.now() } = {}) {
    this.api = client; this.n = notify; this.onDemo = onDemo; this.onFunctions = onFunctions;
    this.catalogo = new Map(); this.activo = null; this.demo = false; this.demoPendiente = false;
    this.paradas = 0; this.pendientes = 0; this.detenciones = 0; this.intencion = 0; this.demoVersion = 0;
    this.cola = Promise.resolve(); this.timer = null; this.deseado = null;
    this.paradaEnCurso = Promise.resolve(true); this.intencionParada = -1;
    this.schedule = schedule; this.unschedule = unschedule; this.now = now;
    this.funciones = estadoInicial(initialFunctions); this.versionFunciones = 0;
  }
  async cargar() {
    this.catalogo.clear();
    (await this.api.comandos()).filter(c => c.activo).forEach(c => this.catalogo.set(c.nombre, c));
  }
  tiene(nombre) { return this.catalogo.has(nombre); }
  get ocupado() { return !!(this.deseado || this.activo || this.pendientes || this.demo || this.demoPendiente); }
  setDemo(value) { this.demo = value; this.onDemo(value || this.demoPendiente); }
  publicarFunciones() { this.versionFunciones++; this.onFunctions({ ...this.funciones }); }
  sincronizarFunciones(snapshot) {
    const patch = funcionesDeTelemetria(snapshot);
    if (Object.entries(patch).some(([key, value]) => this.funciones[key] !== value)) {
      this.funciones = {...this.funciones,...patch}; this.publicarFunciones();
    }
  }

  iniciar(nombre) {
    if (!PULSOS.has(nombre) && this.deseado === nombre && (this.activo === nombre || this.pendientes)) return this.cola;
    this.unschedule(this.timer); this.timer = null;
    this.deseado = PULSOS.has(nombre) ? null : nombre;
    const epoch = this.paradas, token = ++this.intencion;
    this.pendientes++;
    const job = this.cola.then(() => {
      // Descarta direcciones intermedias acumuladas; nunca ejecuta órdenes previas a DETENER.
      if (epoch !== this.paradas || (!PULSOS.has(nombre) && token !== this.intencion)) return false;
      return this._iniciar(nombre, epoch, token);
    }).finally(() => { this.pendientes--; });
    this.cola = job.catch(() => {});
    return job;
  }
  async _iniciar(nombre, epoch, token) {
    const cmd = this.catalogo.get(nombre), pulso = PULSOS.has(nombre);
    if (!cmd) { if (token === this.intencion) this.deseado = null; this.n('error', `${nombre} no está disponible en el catálogo`); return false; }
    // Cruzar el centro envía STOP. Conserva la última dirección hasta que ese STOP termine.
    const stopped = await this.paradaEnCurso;
    if (epoch !== this.paradas || (!pulso && token !== this.intencion)) return false;
    if (!stopped) { this.deseado = null; this.n('error', 'No se confirmó la parada anterior. Vuelve a pulsar DETENER.'); return false; }
    if (this.demo || this.demoPendiente) { this.deseado = null; this.n('error', 'Detén la DEMO antes de usar los controles'); return false; }
    const functionKey = {ENCENDER_APAGAR:'encendido',SONIDO:'sonido',LUCES:'luces'}[nombre];
    const siguiente = functionKey ? !this.funciones[functionKey] : null;
    try {
      if (this.activo && (pulso || this.activo !== nombre)) { this.activo = null; await this.api.detener(); }
      if (epoch !== this.paradas || (!pulso && token !== this.intencion)) return false;
      this.n('solicitado', nombre);
      const started = this.now();
      await this.api.mover(cmd.id_comando, pulso ? PULSE_MS : MOVE_MS);
      if (epoch !== this.paradas) { await this.api.detener(); return false; }
      if (nombre === 'ENCENDER_APAGAR') {
        // Estado esperado según la orden aceptada. La confirmación física requiere telemetría.
        this.funciones = { encendido: siguiente, sonido: siguiente, luces: siguiente };
        this.publicarFunciones();
      } else if (nombre === 'SONIDO' || nombre === 'LUCES') {
        this.funciones[functionKey] = siguiente; this.publicarFunciones();
      } else {
        this.activo = nombre;
        if (token === this.intencion && this.deseado === nombre) {
          // Este temporizador solo limpia el estado local; nunca repite la orden.
          const delay = Math.max(0, MOVE_MS - (this.now() - started));
          this.timer = this.schedule(() => {
            if (epoch === this.paradas && token === this.intencion) {
              this.activo = null; this.deseado = null; this.timer = null;
            }
          }, delay);
          this.timer?.unref?.();
        }
      }
      this.n('aceptado', nombre); return true;
    } catch (error) {
      this.activo = null;
      if (token === this.intencion) this.deseado = null;
      this.n('error', `${nombre}: ${error.message}`);
      // Un timeout no demuestra que el servidor haya descartado la orden.
      if (!pulso) { try { await this.api.detener(); } catch { /* El firmware debe limitar la duración. */ } }
      return false;
    }
  }
  detener() {
    // blur, visibilitychange y pointerup pueden representar una misma liberación.
    if (this.detenciones && this.intencion === this.intencionParada) return this.paradaEnCurso;
    this.paradas++; this.intencion++; this.intencionParada = this.intencion;
    this.deseado = null; this.activo = null; this.unschedule(this.timer); this.timer = null; this.detenciones++;
    this.n('solicitado', 'DETENER');
    const previous = this.paradaEnCurso;
    const job = (async () => { try {
      await this.api.detener(); this.setDemo(false); this.n('aceptado', 'DETENER'); return true;
    } catch (error) { this.n('error', `DETENER: ${error.message}`); return false; }
    finally { this.detenciones--; } })();
    this.paradaEnCurso = Promise.all([previous, job]).then(([,ok]) => ok);
    return this.paradaEnCurso;
  }
  async iniciarDemo(id) {
    if (!id || this.demo || this.demoPendiente || this.pendientes || this.detenciones || this.activo) {
      this.n('error', 'Selecciona una DEMO y detén los movimientos antes de ejecutarla'); return false;
    }
    const epoch = this.paradas, version = this.demoVersion;
    this.demoPendiente = true; this.onDemo(true); this.n('solicitado', `DEMO ${id}`);
    try {
      await this.api.ejecutarDemo(id);
      if (epoch !== this.paradas) { await this.api.detener(); return false; }
      if (version === this.demoVersion) this.setDemo(true);
      this.n('aceptado', `DEMO ${id}`); return true;
    } catch (error) { this.n('error', `DEMO: ${error.message}`); return false; }
    finally { this.demoPendiente = false; this.onDemo(this.demo); }
  }
  async cancelarDemo() {
    // Usa la misma barrera de cancelación que DETENER, también durante un inicio pendiente.
    this.paradas++; this.intencion++;
    try { await this.api.cancelarDemo(); this.setDemo(false); this.n('aceptado', 'DEMO cancelada'); }
    catch (error) { this.n('error', `Cancelar: ${error.message}`); }
  }
  evento(message) {
    this.sincronizarFunciones(message.estado || message);
    const type = message.tipo;
    if (type === 'DEMO_INICIADA' && !this.demoPendiente) this.setDemo(true);
    if (['DEMO_FINALIZADA', 'DEMO_CANCELADA', 'DEMO_ERROR', 'EMERGENCIA'].includes(type)) { this.demoVersion++; this.setDemo(false); }
    if (type === 'EMERGENCIA') {
      this.activo = null;
      // El evento puede corresponder al STOP interno de un cambio de dirección.
      // La barrera local mantiene válida la dirección nueva que espera ese STOP.
    }
    if (type === 'MOVIMIENTO_INDIVIDUAL') this.n('evento', `${message.comando} · código ${message.codigo}`);
    else if (type?.startsWith('DEMO_') || type === 'EMERGENCIA') this.n('evento', type.replaceAll('_', ' '));
  }
}
