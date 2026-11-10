import { WS_BASE, VEHICLE_ID } from "./config.js";

// Sesión WSS real del navegador. No indica que el vehículo físico esté conectado.
export function conectarWs({ onEstado, onEvento }, id = VEHICLE_ID) {
  let intentos = 0, cerrado = false, ws;
  const abrir = () => {
    if (cerrado) return;
    onEstado(intentos ? "reconectando" : "conectando");
    ws = new WebSocket(`${WS_BASE}/ws/vehiculos/${id}`);
    ws.onopen = () => { intentos = 0; onEstado("en_linea"); };
    ws.onmessage = (e) => { try { onEvento(JSON.parse(e.data)); } catch { /* mensaje no válido */ } };
    ws.onclose = () => { if (cerrado) return; onEstado("desconectado"); intentos++; setTimeout(abrir, Math.min(1000 * 2 ** intentos, 15000)); };
    ws.onerror = () => ws.close();
  };
  abrir();
  return { cerrar() { cerrado = true; ws && ws.close(); } };
}
