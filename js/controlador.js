import { api } from "./api.js";
import { MOVE_MS } from "./config.js";

// Direcciones del joystick -> nombres del catálogo real (GET /vehiculos/1/comandos).
export const DIRECCIONES = { arriba: "AVANZAR", abajo: "RETROCEDER", izquierda: "IZQUIERDA", derecha: "DERECHA" };
export const DIRECCIONES2 = { arriba: "LEVANTAR", abajo: "BAJAR", izquierda: "GIRAR_IZQUIERDA", derecha: "GIRAR_DERECHA" };
export const BOTONES = ["ENCENDER_APAGAR", "SONIDO", "LUCES"];
export const PULSOS = new Set(["ENCENDER_APAGAR", "SONIDO", "LUCES"]);   // el firmware fija su duración

export class Controlador {
  constructor(notificar, alCambiarDemo) {
    this.n = notificar; this.alCambiarDemo = alCambiarDemo;
    this.catalogo = new Map(); this.activo = null; this.demo = false;
    this.paradas = 0; this.cola = Promise.resolve();
  }
  async cargar() { (await api.comandos()).filter((c) => c.activo).forEach((c) => this.catalogo.set(c.nombre, c)); }
  tiene(nombre) { return this.catalogo.has(nombre); }
  setDemo(v) { this.demo = v; this.alCambiarDemo(v); }

  // Una sola lógica de envío para joystick y botones; las órdenes se encolan para no solaparse.
  iniciar(nombre) {
    const par = this.paradas;
    this.cola = this.cola.then(() => (par === this.paradas ? this._iniciar(nombre, par) : null));
    return this.cola;
  }
  async _iniciar(nombre, par) {
    const cmd = this.catalogo.get(nombre);
    if (!cmd) return this.n("error", `${nombre} no está en el catálogo`);
    if (this.demo) return this.n("error", "Hay una DEMO en ejecución: usa DETENER");
    const pulso = PULSOS.has(nombre);
    if (!pulso && this.activo === nombre) return;              // sin duplicados
    try {
      if (this.activo) { this.activo = null; await api.detener(); }   // cambio de dirección
      this.n("solicitado", nombre);
      await api.mover(cmd.id_comando, MOVE_MS);
      if (par !== this.paradas) { await api.detener(); return; }       // respuesta tardía tras DETENER
      if (!pulso) this.activo = nombre;
      this.n("aceptado", nombre);
    } catch (e) { this.activo = null; this.n("error", `${nombre}: ${e.message}`); }
  }

  // DETENER: prioridad absoluta, no espera a la cola.
  async detener() {
    this.paradas++; this.activo = null;
    this.n("solicitado", "DETENER");
    try { await api.detener(); this.setDemo(false); this.n("aceptado", "DETENER"); }
    catch (e) { this.n("error", `DETENER: ${e.message}`); }
  }

  async iniciarDemo(id) {
    if (this.demo) return this.n("error", "Ya hay una DEMO en ejecución");
    if (!id) return this.n("error", "Selecciona una DEMO");
    this.n("solicitado", `DEMO ${id}`);
    try { await api.ejecutarDemo(id); this.setDemo(true); this.n("aceptado", `DEMO ${id}`); }
    catch (e) { this.n("error", `DEMO: ${e.message}`); }
  }
  async cancelarDemo() {
    this.n("solicitado", "Cancelar DEMO");
    try { await api.cancelarDemo(); this.n("aceptado", "Cancelar DEMO"); }
    catch (e) { this.n("error", `Cancelar: ${e.message}`); }
  }

  // Eventos recibidos por la sesión WSS propia.
  evento(m) {
    const t = m.tipo;
    if (t === "DEMO_INICIADA") this.setDemo(true);
    if (["DEMO_FINALIZADA", "DEMO_CANCELADA", "DEMO_ERROR", "EMERGENCIA"].includes(t)) this.setDemo(false);
    if (t === "MOVIMIENTO_INDIVIDUAL") this.n("evento", `${m.comando} (código ${m.codigo})`);
    else if (t?.startsWith("DEMO_") || t === "EMERGENCIA")
      this.n("evento", t + (m.orden ? ` ${m.orden}/${m.total_movimientos}` : ""));
  }
}
