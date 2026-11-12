// Configuración pública. Las credenciales se definen únicamente en el servidor.
export const API_BASE = 'https://iot-vehiculos.duckdns.org';
export const WS_BASE = API_BASE.replace(/^http/, 'ws');
export const VEHICLE_ID = 1;
export const CONTROL_ENDPOINT = '/api/control';
export const HEALTH_PATH = '/';
export const HEALTH_EVERY_MS = 15000;
export const TIMEOUT_MS = 6000;
// Una orden por dirección, con el límite original de 5 s. Soltar envía emergencia antes.
export const MOVE_MS = 5000;
export const PULSE_MS = 100;
