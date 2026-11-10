import { api, setClave } from "./api.js";
import { montarMenu } from "./nav.js";

const $ = (id) => document.getElementById(id);
const msg = (t, err) => { $("msg").textContent = t; $("msg").className = err ? "err" : ""; };
const vid = () => $("veh").value;

function tabla(cont, cols, filas, borrar) {
  const t = document.createElement("table"); t.className = "tabla";
  filas.forEach((f) => {
    const tr = document.createElement("tr");
    cols.forEach((c) => { const td = document.createElement("td"); td.textContent = f[c] ?? "—"; tr.appendChild(td); });
    const td = document.createElement("td"), b = document.createElement("button");
    b.type = "button"; b.textContent = "Eliminar"; b.onclick = () => borrar(f); td.appendChild(b); tr.appendChild(td); t.appendChild(tr);
  });
  cont.replaceChildren(t);
}
async function accion(fn, ok) {
  try { await fn(); msg(ok); } catch (e) { msg(e.message, true); }
}
async function cargarVeh() {
  const v = await api.vehiculos();
  tabla($("t-veh"), ["id_vehiculo", "nombre", "modelo", "microcontrolador"], v, (f) => {
    if (confirm(`¿Eliminar el vehículo ${f.nombre}?`)) accion(async () => { await api.borrar(`/vehiculos/${f.id_vehiculo}`); await recargar(); }, "Vehículo eliminado");
  });
  const actual = $("veh").value; $("veh").replaceChildren();
  v.forEach((x) => $("veh").add(new Option(x.nombre, x.id_vehiculo)));
  if (actual) $("veh").value = actual;
}
async function cargarHijos() {
  if (!vid()) return;
  tabla($("t-cmd"), ["id_comando", "nombre", "codigo", "activo"], await api.listar(`/vehiculos/${vid()}/comandos`), (f) => {
    if (confirm(`¿Eliminar el comando ${f.nombre}?`)) accion(async () => { await api.borrar(`/vehiculos/${vid()}/comandos/${f.id_comando}`); await cargarHijos(); }, "Comando eliminado");
  });
  tabla($("t-demo"), ["id_demo", "nombre", "activo"], await api.listar(`/vehiculos/${vid()}/demos`), (f) => {
    if (confirm(`¿Eliminar la DEMO ${f.nombre}?`)) accion(async () => { await api.borrar(`/vehiculos/${vid()}/demos/${f.id_demo}`); await cargarHijos(); }, "DEMO eliminada");
  });
}
const recargar = async () => { await cargarVeh(); await cargarHijos(); };
const req = (...ids) => ids.every((i) => $(i).value.trim());

$("v-crear").onclick = () => req("v-nombre", "v-modelo", "v-micro")
  ? accion(async () => { await api.crear("/vehiculos", { nombre: $("v-nombre").value.trim(), modelo: $("v-modelo").value.trim(), descripcion: $("v-desc").value.trim(), microcontrolador: $("v-micro").value.trim() }); await recargar(); }, "Vehículo creado")
  : msg("Completa nombre, modelo y microcontrolador", true);
$("c-crear").onclick = () => req("c-nombre", "c-codigo")
  ? accion(async () => { await api.crear(`/vehiculos/${vid()}/comandos`, { nombre: $("c-nombre").value.trim(), codigo: Number($("c-codigo").value), descripcion: $("c-desc").value.trim() }); await cargarHijos(); }, "Comando creado")
  : msg("Completa nombre y código", true);
$("d-crear").onclick = () => req("d-nombre")
  ? accion(async () => { await api.crear(`/vehiculos/${vid()}/demos`, { nombre: $("d-nombre").value.trim(), descripcion: $("d-desc").value.trim() }); await cargarHijos(); }, "DEMO creada")
  : msg("Escribe el nombre de la DEMO", true);
$("guardar").onclick = () => { setClave($("clave").value); $("clave").value = ""; msg("Clave en memoria de la sesión"); };
$("veh").onchange = () => cargarHijos().catch((e) => msg(e.message, true));
montarMenu();
recargar().catch((e) => msg(e.message, true));
