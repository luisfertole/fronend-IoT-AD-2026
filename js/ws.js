import { WS_BASE, VEHICLE_ID } from "./config.js";

const MAX_INTENTOS = 5;   // evita llenar la consola si una extensión o la red bloquean el WSS

// Sesión WSS real del navegador. No indica que el vehículo físico esté conectado.
export function conectarWs({ onEstado, onEvento }, id = VEHICLE_ID) {
  let intentos = 0, cerrado = false, ws, timer;
  const abrir = () => {
    clearTimeout(timer);
    if (cerrado) return;
    onEstado(intentos ? "reconectando" : "conectando");
    ws = new WebSocket(`${WS_BASE}/ws/vehiculos/${id}`);
    ws.onopen = () => { intentos = 0; onEstado("en_linea"); };
    ws.onmessage = (e) => { try { onEvento(JSON.parse(e.data)); } catch { /* mensaje no válido */ } };
    ws.onclose = () => {
      if (cerrado) return;
      onEstado("desconectado");
      if (++intentos >= MAX_INTENTOS) return;           // se detiene; volver a la pestaña o recuperar la red reintenta
      timer = setTimeout(abrir, Math.min(2000 * 2 ** intentos, 30000));
    };
    ws.onerror = () => ws.close();
  };
  const reintentar = () => {
    if (!cerrado && (!ws || ws.readyState === WebSocket.CLOSED)) { intentos = 0; abrir(); }
  };
  const alVolver = () => { if (!document.hidden) reintentar(); };
  addEventListener("online", reintentar);
  document.addEventListener("visibilitychange", alVolver);
  abrir();
  return {
    cerrar() {
      cerrado = true; clearTimeout(timer);
      removeEventListener("online", reintentar);
      document.removeEventListener("visibilitychange", alVolver);
      ws && ws.close();
    },
  };
}