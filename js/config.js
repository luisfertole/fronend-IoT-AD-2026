// Solo datos públicos: aquí NO van claves ni credenciales.
export const API_BASE = "https://iot-vehiculos.duckdns.org";
export const WS_BASE = API_BASE.replace(/^https/, "wss");
export const VEHICLE_ID = 1;
export const HEALTH_PATH = "/";        // GET público que responde {"status": "API operativa"}
export const RDS_DIAG_PATH = null;     // sin diagnóstico seguro en el backend -> "Sin verificar"
export const HEALTH_EVERY_MS = 15000;
export const TIMEOUT_MS = 6000;
export const MOVE_MS = 5000;           // duración máxima del movimiento; DETENER lo corta antes
