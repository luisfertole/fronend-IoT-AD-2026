# Control IoT (frontend)

Aplicación web de CONTROL del vehículo IoT. HTML5 + CSS3 + Bootstrap 5 + JavaScript (módulos ES). Consume la API REST de FastAPI en AWS y una sesión WSS propia.

## Estructura
| Archivo | Responsabilidad |
|---|---|
| `index.html`, `css/estilos.css`, `favicon.svg` | Interfaz Mobile First, créditos al pie, favicon |
| `js/config.js` | URL base, id del vehículo y rutas de salud (sin secretos) |
| `js/api.js` | Cliente Fetch: timeout, errores HTTP, encabezado `X-API-Key` |
| `js/ws.js` | Sesión WSS con reconexión; alimenta el indicador WebSocket |
| `js/controlador.js` | Lógica única de comandos, DEMO y prioridad de DETENER |
| `js/ui.js` | Joystick, botones, selector de DEMO, indicadores y mensajes |
| `js/main.js` | Arranque, comprobación periódica de API y conexión de módulos |

## Contrato de la API usado
- `GET /vehiculos/{id}`, `GET /vehiculos/{id}/comandos`, `GET /vehiculos/{id}/demos`
- `POST /vehiculos/{id}/mover?id_comando=N&duracion_ms=M` (header `X-API-Key`)
- `POST /vehiculos/{id}/demos/{id_demo}/ejecutar` y `POST /vehiculos/{id}/demos/cancelar`
- `POST /vehiculos/{id}/emergencia` → **DETENER** (el catálogo no tiene un comando DETENER)
- WSS: `/ws/vehiculos/{id}` → `ESTADO_INICIAL`, `MOVIMIENTO_INDIVIDUAL`, `DEMO_INICIADA`, `DEMO_MOVIMIENTO`, `DEMO_FINALIZADA`, `DEMO_CANCELADA`, `DEMO_ERROR`, `EMERGENCIA`

## Ejecución local
`python -m http.server 5500` y abre `http://127.0.0.1:5500` (agrega ese origen a `CORS_ORIGINS` del servidor).

## Seguridad
La clave de la API se escribe al entrar y vive solo en memoria. No hay credenciales en el repositorio. Los textos remotos se pintan con `textContent`. CORS limita orígenes, no autentica.

## Indicadores
WebSocket = sesión del navegador (no prueba que el vehículo esté conectado). API = consulta periódica a `HEALTH_PATH`. RDS = "Sin verificar" mientras el backend no exponga un diagnóstico seguro (`RDS_DIAG_PATH`).

## Publicar en GitHub Pages
1. `git init`, `git add .`, `git commit -m "Control IoT"`, crea el repositorio y `git push`.
2. Settings, Pages, Source: rama `main`, carpeta `/ (root)`.
3. URL: `https://luisfertole.github.io/NOMBRE_REPO/`.

## Pruebas
Con un cliente WSS externo conectado a `wss://iot-vehiculos.duckdns.org/ws/vehiculos/1`:
- **A:** presiona Avanzar → POST 200 y evento `MOVIMIENTO_INDIVIDUAL` (vehículo, comando y código).
- **B:** cambia de dirección y suelta el joystick → nuevo movimiento y luego `EMERGENCIA`, sin duplicados.
- **C:** ejecuta una DEMO → `DEMO_INICIADA`, N `DEMO_MOVIMIENTO` y `DEMO_FINALIZADA`; Cancelar → `DEMO_CANCELADA`.
- **D:** apaga la red → WebSocket pasa a Desconectado/Reconectando y API a No disponible; al volver se recuperan.
- **E:** revisa móvil vertical/horizontal y escritorio.
Un evento WSS confirma la publicación por el backend, no el movimiento físico.
