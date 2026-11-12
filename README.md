# Unidad 02 · Consola IoT

Aplicación web para controlar, monitorear y administrar un vehículo IoT conectado a FastAPI en EC2. Utiliza JavaScript con módulos ES, HTML semántico y CSS modular, sin compilación ni dependencias de producción. Incluye un diseño futurista adaptable con acentos ámbar e indicadores activos blancos.

Desarrollado por Luis Fernando Tolentino Segovia · 2026.

| Página | Funcionalidad |
|---|---|
| Control | Dos joysticks con señalización interior, encendido, sonido, luces, DETENER y DEMO; cabe en un solo viewport en vertical y horizontal. |
| Monitoreo | Estado, eventos WebSocket y los últimos 10 movimientos del vehículo seleccionado. |
| Administración | Crear y eliminar vehículos, comandos y DEMO mediante una clave administrativa separada. |

## Ejecución local

Requiere Node.js 22 o posterior.

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Edita .env.local y completa IOT_API_KEY únicamente allí.
npm run dev
```

Abre http://127.0.0.1:5500. Control no pide introducir una clave. El servidor local lee `.env.local` y reenvía las órdenes a EC2. Las consultas REST y la administración también pasan por el servidor del proyecto, mediante `/api/backend`; el navegador no hace fetch directo a EC2 y no depende de su configuración CORS.

Para revisar diseño e interacciones sin conectar con EC2 ni enviar órdenes al vehículo:

```powershell
npm run preview
```

La simulación muestra una banda visible y sustituye REST y WebSocket. Los cambios simulados se reinician al recargar.

## Estructura modular

```text
fronend-IoT-AD-2026/
├── index.html                  Página de Control
├── monitoreo.html              Página de Monitoreo
├── admin.html                  Página de Administración
├── favicon.svg
├── assets/css/
│   ├── app.css                 Entrada de estilos
│   ├── tokens.css              Colores, fuentes y variables
│   ├── base.css                Elementos y accesibilidad
│   ├── layout.css              Estructura y navegación
│   ├── components.css          Componentes compartidos
│   ├── control.css             Joysticks, botones y DEMO
│   ├── data-pages.css          Monitoreo y administración
│   └── control-viewport.css    Control sin desplazamiento
├── src/
│   ├── config/app.js           Configuración pública, sin claves
│   ├── services/
│   │   ├── http.js             Peticiones REST al mismo origen
│   │   ├── vehicle-api.js      Operaciones del vehículo
│   │   └── websocket.js        Eventos y reconexión WSS
│   ├── shared/
│   │   ├── dom.js              Utilidades para elementos y mensajes
│   │   └── navigation.js       Navegación compartida
│   ├── features/
│   │   ├── control/
│   │   │   ├── page.js         Arranque y conexión de Control
│   │   │   ├── controller.js   Órdenes, cola y prioridad de DETENER
│   │   │   ├── joystick.js     Entrada táctil, ratón y teclado
│   │   │   ├── commands.js     Mapeo de direcciones y funciones
│   │   │   ├── function-state.js Persistencia y telemetría de botones
│   │   │   └── ui.js           Indicadores, mensajes y estados visuales
│   │   ├── monitoring/page.js
│   │   └── admin/page.js
│   └── dev/mock.js             Simulación exclusiva de preview
├── api/
│   ├── control.mjs             Función de control para Vercel
│   └── backend.mjs             Función REST para Vercel
├── server/
│   ├── control-gateway.mjs     Control con la clave privada del servidor
│   └── backend-gateway.mjs     Lecturas y administración con rutas limitadas
├── scripts/dev-server.mjs      Servidor local
├── tests/
│   ├── controller.test.mjs     Cancelación, cola y respuestas tardías
│   ├── reactivity.test.mjs     Dirección, duración y liberación del joystick
│   ├── function-state.test.mjs Conservación de estados y telemetría
│   ├── gateway.test.mjs        Validación del control y aislamiento de la clave
│   └── backend-gateway.test.mjs Rutas REST y acceso administrativo
├── docs/
│   ├── DESPLIEGUE.md           Configuración local y Vercel
│   └── MEJORAS.md              Próximas etapas
├── .env.example                Plantilla sin credenciales
├── .gitignore                  Exclusiones de Git
├── .vercelignore               Exclusiones del despliegue
├── package.json
├── README.md
└── vercel.json
```

Las rutas HTML originales se conservan. Los archivos antiguos `js/` y `css/` se sustituyen por `src/` y `assets/css/`.

## Acceso sin capturar API key

```text
Navegador → /api/control → función Node → FastAPI en EC2
                              │
                    IOT_API_KEY del servidor
```

La clave de control no se guarda en el navegador ni se devuelve en respuestas. El gateway admite únicamente mover, detener, ejecutar DEMO y cancelar DEMO para `IOT_VEHICLE_ID`; limita la duración a 5000 ms y no admite rutas administrativas arbitrarias.

Esto permite controlar sin identificarse a quien pueda acceder al sitio. Ocultar la clave no autentica visitantes. La validación de origen bloquea solicitudes desde otros sitios en navegadores, pero no sustituye una sesión de operador. Para restringir operadores se necesita control de acceso en el servidor.

Las lecturas y la administración usan `/api/backend?path=...` en el mismo origen. Este gateway admite únicamente rutas públicas y operaciones administrativas específicas; no acepta URLs externas ni operaciones de movimiento. Las lecturas no llevan la clave privada de control.

Administración conserva su propio formulario de clave y la guarda en `sessionStorage` durante esa sesión de pestaña. El gateway reenvía esa clave a EC2 para las operaciones administrativas y nunca la sustituye por la clave privada de control.

## Vercel

1. Selecciona Framework Preset **Other**, raíz del proyecto, sin build ni directorio de salida personalizado.
2. Agrega `IOT_API_KEY` en **Settings → Environment Variables**. Nunca la coloques en HTML ni en la configuración pública.
3. Opcionalmente configura `IOT_API_BASE=https://iot-vehiculos.duckdns.org` e `IOT_VEHICLE_ID=1`.
4. Vuelve a desplegar para aplicar las variables y habilitar `/api/control`.
5. Verifica que las dos funciones, `/api/control` y `/api/backend`, estén desplegadas. No necesitas modificar el CORS de EC2 para el flujo REST incluido.

No subas `.env.local` a Git. En Vercel la clave se introduce en su configuración del servidor.

| Variable de Vercel | Valor |
|---|---|
| `IOT_API_KEY` | Clave real que espera FastAPI; solo se configura en el servidor. |
| `IOT_API_BASE` | `https://iot-vehiculos.duckdns.org` |
| `IOT_VEHICLE_ID` | `1` |

Configura la clave en **Production** y también en **Preview** si usarás los despliegues de prueba. Después de agregar o cambiar las variables, realiza un nuevo despliegue. Los visitantes de Control no necesitan capturar la clave. El archivo de configuración local no se publica; `.env.example` se conserva únicamente como plantilla vacía.

WebSocket se conecta directamente a `wss://iot-vehiculos.duckdns.org/ws/vehiculos/1`. Si devuelve 404, revisa la ruta de FastAPI y el proxy de EC2; el frontend no puede corregir una ruta ausente en el servidor.

GitHub Pages y `python -m http.server` no ejecutan los gateways de este proyecto. Para cargar datos y controlar utiliza Vercel o el servidor Node incluido.

Referencias oficiales: [Funciones Node](https://vercel.com/docs/functions/runtimes/node-js), [Variables de entorno](https://vercel.com/docs/environment-variables).

## Controles y estados

| Joystick | ↑ | ↓ | ← | → |
|---|---|---|---|---|
| Desplazamiento | Adelante | Retroceder | Mover a la izquierda | Mover a la derecha |
| Pala y rotación | Levantar pala | Bajar pala | Rotar a la izquierda | Rotar a la derecha |

Las señalizaciones se encuentran dentro del círculo de cada joystick y también funcionan como botones: mantén para mover y suelta para detener. Puedes enfocar cada joystick y utilizar las flechas del teclado.

Control ocupa un único viewport, sin desplazamiento vertical ni horizontal. La distribución se ajusta a escritorio, teléfono vertical y teléfono horizontal. En pantallas pequeñas se ocultan encabezados secundarios, notas y el registro de actividad para mantener visibles los dos joysticks, los tres botones, DETENER y las DEMO. Monitoreo y Administración conservan su desplazamiento para tablas y formularios.

- En la primera visita de la sesión, Encender/Apagar inicia en **Apagado**. Las visitas siguientes, las recargas y la navegación por Monitoreo/Administración restauran los estados aceptados de encendido, sonido y luces para ese vehículo. Entrar al sitio no envía una orden de encendido ni reanuda movimientos.
- Después de aceptar el POST `ENCENDER_APAGAR`, el botón se ilumina blanco y muestra **Encendido**. Sonido y luces aparecen activados automáticamente.
- Sonido y luces alternan su estado después de que su POST sea aceptado. Los errores conservan el estado anterior.
- Al apagar, los tres indicadores de sesión vuelven a apagado.
- Al encender no se envían POST adicionales de SONIDO/LUCES: siendo comandos de alternancia, podrían invertir el comportamiento del firmware. Se presupone el comportamiento de encendido solicitado por el usuario.
- Son **estados esperados de sesión**, conservados en `sessionStorage`, no confirmación física. Si REST o WSS informan explícitamente `encendido`, `sonido` o `luces` como booleanos o 0/1, la telemetría actualiza esos campos. El último comando o el indicador de conexión no se interpretan como estado de los interruptores. Sin esos campos, los cambios hechos por otros operadores requieren telemetría del backend/firmware.
- El joystick envía **una sola orden por dirección**, con el límite original de **5000 ms**. No divide el movimiento en pulsos ni repite la orden periódicamente. Soltar o pulsar DETENER envía emergencia sin esperar a que transcurran los cinco segundos. Para otro movimiento después del límite, vuelve al centro y acciona de nuevo el joystick. Los botones de encendido, sonido y luces usan pulsos de **100 ms** y no se repiten.
- Al invertir la dirección se conserva la última intención. Si se cruza el centro y todavía está respondiendo STOP, la dirección nueva espera esa parada y después se ejecuta; las direcciones intermedias se descartan.
- DETENER invalida la cola y envía emergencia inmediatamente; una orden ya enviada que responda tarde provoca otra emergencia. Cambiar de ventana también detiene operaciones pendientes. Los eventos duplicados de una misma liberación comparten la parada en curso.
- La respuesta efectiva depende de la latencia de red y de EC2/firmware. El límite físico y la prioridad definitiva de emergencia deben existir allí; un navegador sin red no puede garantizar una parada.

Monitoreo descarta respuestas de vehículos anteriores, limita eventos a 100 y muestra 10 registros de historial. Administración valida códigos enteros 0–255 y conserva el vehículo seleccionado solo si sigue existiendo. Las tablas, etiquetas y campos tienen colores explícitos para garantizar legibilidad.

## Pruebas

```powershell
npm test
```

Las 38 pruebas actuales verifican cancelación, respuestas tardías, estados de botones, validación de acciones e aislamiento de secretos. No sustituyen una prueba del dispositivo físico.

Consulta [Configuración de la clave](docs/DESPLIEGUE.md) y [Mejoras propuestas](docs/MEJORAS.md). El despliegue y la conexión real requieren configurar la variable del servidor.
