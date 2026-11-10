import { api } from "./api.js";
import { conectarWs } from "./ws.js";
import { montarMenu } from "./nav.js";
import { VEHICLE_ID } from "./config.js";

const $ = (id) => document.getElementById(id);
const ETQ = { en_linea: "En línea", conectando: "Conectando…", reconectando: "Reconectando…", desconectado: "Desconectado" };
let ws = null;

function linea(txt, cls) {
  const d = document.createElement("div"); d.textContent = txt; if (cls) d.className = cls; return d;
}
function pintarEstado(e) {
  $("estado").replaceChildren(...Object.entries(e || {}).map(([k, v]) => linea(`${k}: ${v}`)));
}
async function historial() {
  const h = await api.historial($("veh").value);
  $("hist").replaceChildren(...h.historial.map((r) => {
    const tr = document.createElement("tr");
    [r.fecha_hora, r.comando, r.codigo, r.origen].forEach((v) => { const td = document.createElement("td"); td.textContent = v ?? "—"; tr.appendChild(td); });
    return tr;
  }));
}
async function cargar() {
  const id = $("veh").value; $("msg").textContent = "";
  try { pintarEstado(await api.estado(id)); await historial(); }
  catch (e) { $("msg").textContent = e.message; }
  if (ws) ws.cerrar();
  $("eventos").replaceChildren();
  ws = conectarWs({
    onEstado: (s) => { $("ws-est").textContent = ETQ[s]; },
    onEvento: (m) => {
      if (m.estado) pintarEstado(m.estado);
      $("eventos").prepend(linea(`${new Date().toLocaleTimeString()}  ${m.tipo}${m.comando ? " " + m.comando : ""}${m.orden ? " " + m.orden + "/" + m.total_movimientos : ""}`));
      if (m.tipo === "MOVIMIENTO_INDIVIDUAL") historial().catch(() => {});
    },
  }, id);
}
montarMenu();
api.vehiculos().then((v) => {
  v.forEach((x) => $("veh").add(new Option(x.nombre || `Vehículo ${x.id_vehiculo}`, x.id_vehiculo)));
  $("veh").value = String(VEHICLE_ID); cargar();
}).catch((e) => { $("msg").textContent = e.message; });
$("veh").onchange = cargar;
