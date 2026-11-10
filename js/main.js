import { api, setClave } from "./api.js";
import { conectarWs } from "./ws.js";
import { Controlador, DIRECCIONES, DIRECCIONES2 } from "./controlador.js";
import { montarMenu } from "./nav.js";
import { HEALTH_PATH, HEALTH_EVERY_MS, RDS_DIAG_PATH, VEHICLE_ID } from "./config.js";
import { mostrarMensaje, setIndicador, crearJoystick, crearBotones, cargarDemos, bloquearDemo } from "./ui.js";

const $ = (id) => document.getElementById(id);
const ctl = new Controlador(mostrarMensaje, bloquearDemo);

async function comprobar() {
  setIndicador("api", "comprobando");
  try { await api.salud(HEALTH_PATH); setIndicador("api", "ok"); } catch { setIndicador("api", "error"); }
  if (!RDS_DIAG_PATH) return setIndicador("db", "sin_verificar");   // sin diagnóstico seguro: no se afirma nada
  try { await api.salud(RDS_DIAG_PATH); setIndicador("db", "ok"); } catch { setIndicador("db", "error"); }
}

async function iniciar() {
  setIndicador("ws", "conectando"); setIndicador("db", "sin_verificar"); bloquearDemo(false);
  conectarWs({ onEstado: (e) => setIndicador("ws", e), onEvento: (m) => ctl.evento(m) });
  comprobar(); setInterval(comprobar, HEALTH_EVERY_MS);
  try {
    const v = await api.vehiculo();
    $("veh").textContent = v.nombre || v.vehiculo || `Vehículo ${VEHICLE_ID}`;
    await ctl.cargar(); crearJoystick(ctl, "joy", "knob", DIRECCIONES); crearJoystick(ctl, "joy2", "knob2", DIRECCIONES2); crearBotones(ctl);
    cargarDemos(await api.demos());
  } catch (e) { mostrarMensaje("error", e.message); }
}

$("guardar").onclick = () => { setClave($("clave").value); $("clave").value = ""; mostrarMensaje("aceptado", "Clave en memoria"); };
$("detener").onclick = () => ctl.detener();
$("demo-run").onclick = () => ctl.iniciarDemo($("demo").value);
$("demo-cancel").onclick = () => ctl.cancelarDemo();
addEventListener("blur", () => ctl.activo && ctl.detener());
document.addEventListener("visibilitychange", () => document.hidden && ctl.activo && ctl.detener());
montarMenu();
iniciar();
