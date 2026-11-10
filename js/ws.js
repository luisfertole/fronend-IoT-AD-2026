import { WS_BASE, VEHICLE_ID } from "./config.js";

// Sesión WSS real del navegador. No indica que el vehículo físico esté conectado.
export function conectarWs({ onEstado, onEvento }) {
  let intentos = 0;
  const abrir = () => {
    onEstado(intentos ? "reconectando" : "conectando");
    const ws = new WebSocket(`${WS_BASE}/ws/vehiculos/${VEHICLE_ID}`);
    ws.onopen = () => { intentos = 0; onEstado("en_linea"); };
    ws.onmessage = (e) => { try { onEvento(JSON.parse(e.data)); } catch { /* mensaje no válido */ } };
    ws.onclose = () => { onEstado("desconectado"); intentos++; setTimeout(abrir, Math.min(1000 * 2 ** intentos, 15000)); };
    ws.onerror = () => ws.close();
  };
  abrir();
}
