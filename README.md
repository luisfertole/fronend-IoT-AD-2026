# Unidad 02 · Frontend IoT (Control, Monitoreo y Administración)

Aplicación web para operar un vehículo IoT. HTML5 + CSS3 + Bootstrap 5 + JavaScript (módulos ES, sin compilación). Consume la API REST de FastAPI en AWS y una sesión WSS propia.

Desarrollado por Luis Fernando Tolentino Segovia · 2026

## Páginas
| Página | Archivo | Función |
|---|---|---|
| Control | `index.html` | Dos joysticks, tres botones centrales, DETENER, selector y ejecución de DEMO, tres indicadores de conexión |
| Monitoreo | `monitoreo.html` | Estado actual, eventos en vivo por WebSocket e historial de los últimos 10 movimientos |
| Administración | `admin.html` | Crear y eliminar vehículos, comandos y DEMO. Usuarios y permisos: pendiente (el backend no tiene esos endpoints) |

El botón ☰ abre un menú lateral para moverse entre las tres. Los enlaces son relativos, por lo que funcionan en GitHub Pages y en Vercel.

### Controles
- **Joystick izquierdo:** arriba AVANZAR · abajo RETROCEDER · izquierda IZQUIERDA · derecha DERECHA.
- **Joystick derecho:** arriba LEVANTAR · abajo BAJAR · izquierda GIRAR_IZQUIERDA · derecha GIRAR_DERECHA.
- **Centro:** ENCENDER_APAGAR, SONIDO y LUCES.
- **DETENER:** prioridad absoluta; también cancela una DEMO. El catálogo no tiene un comando DETENER, por eso usa `POST /vehiculos/{id}/emergencia`.
- Solo hay un movimiento activo a la vez (gana el último). Cada movimiento dura como máximo 5 s.

## Estructura
```
├── index.html · monitoreo.html · admin.html · favicon.svg · README.md
├── css/estilos.css
└── js/
    ├── config.js        URL base, id del vehículo, rutas de salud (sin secretos)
    ├── api.js           Cliente REST: Fetch, timeout, errores, X-API-Key
    ├── ws.js            Sesión WSS con reconexión
    ├── nav.js           Menú lateral compartido
    ├── controlador.js   Lógica de comandos, DEMO y prioridad de DETENER
    ├── ui.js            Joysticks, botones, indicadores y mensajes
    ├── main.js          Arranque de Control
    ├── monitoreo.js     Lógica de Monitoreo
    └── admin.js         Lógica de Administración
```
`api.js` es el único módulo que hace `fetch`; `ws.js` el único que abre WebSockets.

## Contrato de la API usado
- Lectura (públicas): `GET /vehiculos`, `/vehiculos/{id}`, `/vehiculos/{id}/comandos`, `/vehiculos/{id}/demos`, `/vehiculos/{id}/estado`, `/vehiculos/{id}/historial`
- Escritura (header `X-API-Key`):
  - `POST /vehiculos/{id}/mover?id_comando=N&duracion_ms=M`
  - `POST /vehiculos/{id}/emergencia`
  - `POST /vehiculos/{id}/demos/{id_demo}/ejecutar` y `POST /vehiculos/{id}/demos/cancelar`
  - Administración: `POST /vehiculos`, `POST /vehiculos/{id}/comandos`, `POST /vehiculos/{id}/demos`, y los `DELETE` correspondientes
- WSS: `/ws/vehiculos/{id}` → `ESTADO_INICIAL`, `MOVIMIENTO_INDIVIDUAL`, `DEMO_INICIADA`, `DEMO_MOVIMIENTO`, `DEMO_FINALIZADA`, `DEMO_CANCELADA`, `DEMO_ERROR`, `EMERGENCIA`, `DISPOSITIVO_CONECTADO`, `DISPOSITIVO_DESCONECTADO`, `ESTADO_DISPOSITIVO`

## Configuración
Edita `js/config.js`: `API_BASE`, `VEHICLE_ID`, `HEALTH_PATH` y `RDS_DIAG_PATH`.

**CORS (servidor):** la variable `CORS_ORIGINS` del `.env` del backend debe incluir el origen de cada despliegue, sin ruta ni `/` final, por ejemplo `https://luisfertole.github.io,https://TU_PROYECTO.vercel.app`. Los métodos permitidos deben ser GET, POST, PUT y DELETE, y el encabezado `X-API-Key`.

## Ejecución local
`python -m http.server 5500` y abre `http://127.0.0.1:5500` (agrega ese origen a `CORS_ORIGINS`).

## Publicación
- **GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` → `/ (root)`.
- **Vercel:** importa el repositorio con *Framework Preset: Other*, sin build ni variables de entorno. No pases la API ni el WebSocket por Vercel: el navegador se conecta directo al servidor.

## Seguridad
- La clave de la API se escribe al entrar y se guarda solo en `sessionStorage` (se borra al cerrar la pestaña). No hay credenciales en el repositorio.
- Los textos remotos se pintan con `textContent`, nunca como HTML.
- CORS limita orígenes pero no autentica: la protección de escritura es la clave.

## Indicadores
- **WebSocket:** sesión WSS del navegador. No prueba que el vehículo físico esté conectado.
- **API AWS:** consulta periódica a `HEALTH_PATH`; no confirma que los 21 servicios funcionen.
- **RDS:** "Sin verificar" mientras el backend no exponga un diagnóstico seguro.

## Pruebas
Con un cliente WSS externo conectado a `wss://iot-vehiculos.duckdns.org/ws/vehiculos/1`:
- **A:** Avanzar → POST 200 y evento `MOVIMIENTO_INDIVIDUAL` con vehículo, comando y código.
- **B:** cambia de dirección y suelta el joystick → nuevo movimiento y luego `EMERGENCIA`, sin duplicados.
- **C:** ejecuta una DEMO → `DEMO_INICIADA`, N `DEMO_MOVIMIENTO` y `DEMO_FINALIZADA`; Cancelar → `DEMO_CANCELADA`.
- **D:** corta la red → WebSocket pasa a Desconectado/Reconectando y API a No disponible; al volver se recuperan.
- **E:** revisa móvil vertical y horizontal, y escritorio.
- **F:** en Monitoreo, un movimiento desde Control aparece en eventos e historial.
- **G:** en Administración, crea y elimina un vehículo de prueba.

Un evento WSS confirma que el backend lo publicó, no que los motores se movieron.

## Límites
Administración no edita (PUT) ni gestiona los movimientos de cada DEMO (se agregan desde `/docs`). Usuarios y permisos quedan para la etapa de equipo.
