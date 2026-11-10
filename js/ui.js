import { DIRECCIONES, BOTONES, PULSOS } from "./controlador.js";

const $ = (id) => document.getElementById(id);

const LABELS = { solicitado: "Solicitado", aceptado: "Aceptado por API", evento: "Evento recibido", error: "Error" };
export function mostrarMensaje(estado, texto) {
  const caja = $("mensaje"), d = document.createElement("div");
  d.textContent = `${LABELS[estado]}: ${texto}`;
  if (estado === "error") d.className = "err";
  caja.prepend(d);
  while (caja.children.length > 5) caja.lastChild.remove();
}

const ESTADOS = {
  ws: { en_linea: ["ok", "●", "En línea"], conectando: ["warn", "◐", "Conectando…"], reconectando: ["warn", "◐", "Reconectando…"], desconectado: ["mal", "✕", "Desconectado"] },
  api: { ok: ["ok", "●", "Disponible"], comprobando: ["warn", "◐", "Comprobando…"], error: ["mal", "✕", "No disponible"] },
  db: { ok: ["ok", "●", "Disponible"], error: ["mal", "✕", "No disponible"], sin_verificar: ["warn", "?", "Sin verificar"] },
};
export function setIndicador(cual, estado) {
  const [cls, ico, txt] = ESTADOS[cual][estado], el = $("ind-" + cual);
  el.className = "ind " + cls;
  el.querySelector(".ico").textContent = ico;
  el.querySelector(".txt").textContent = txt;
}

export function crearJoystick(ctl) {
  const joy = $("joy"), knob = $("knob");
  let activo = false, dir = null;
  const cambiar = (nueva) => {
    if (nueva === dir) return;
    dir = nueva;
    if (dir) ctl.iniciar(DIRECCIONES[dir]); else ctl.detener();   // un envío por cambio de dirección
  };
  const calc = (e) => {
    const r = joy.getBoundingClientRect(), max = (r.width / 2) * 0.65;
    let x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    const d = Math.hypot(x, y);
    if (d > max) { x *= max / d; y *= max / d; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    cambiar(d < max * 0.45 ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? "derecha" : "izquierda") : (y > 0 ? "abajo" : "arriba"));
  };
  const soltar = () => { if (!activo) return; activo = false; knob.style.transform = ""; cambiar(null); };
  joy.addEventListener("pointerdown", (e) => { activo = true; joy.setPointerCapture(e.pointerId); calc(e); });
  joy.addEventListener("pointermove", (e) => activo && calc(e));
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => joy.addEventListener(ev, soltar));
  const flechas = { ArrowUp: "arriba", ArrowDown: "abajo", ArrowLeft: "izquierda", ArrowRight: "derecha" };
  joy.addEventListener("keydown", (e) => { if (flechas[e.key] && !e.repeat) { e.preventDefault(); cambiar(flechas[e.key]); } });
  joy.addEventListener("keyup", (e) => { if (flechas[e.key]) cambiar(null); });
  joy.addEventListener("blur", () => cambiar(null));
}

export function crearBotones(ctl) {
  const cont = $("botones");
  BOTONES.filter((n) => ctl.tiene(n)).forEach((nombre) => {
    const col = document.createElement("div"); col.className = "col-6";
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-outline-light w-100 btn-ctl";
    b.textContent = nombre.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
    const mov = !PULSOS.has(nombre);
    const inicio = () => { b.classList.add("activo"); ctl.iniciar(nombre); };
    const fin = () => { if (!b.classList.contains("activo")) return; b.classList.remove("activo"); if (mov) ctl.detener(); };
    b.addEventListener("pointerdown", (e) => { b.setPointerCapture(e.pointerId); inicio(); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, fin));
    b.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); inicio(); } });
    b.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") fin(); });
    col.appendChild(b); cont.appendChild(col);
  });
}

export function cargarDemos(lista) {
  const sel = $("demo"); sel.replaceChildren();
  lista.forEach((d) => sel.add(new Option(d.nombre || `Demo ${d.id_demo}`, d.id_demo)));
}
export function bloquearDemo(activa) {
  $("demo").disabled = activa; $("demo-run").disabled = activa; $("demo-cancel").disabled = !activa;
}
