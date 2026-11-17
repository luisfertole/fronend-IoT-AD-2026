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
│   │   ├── navigation.js       Navegación compartida
│   │   └── device-status.js    Normalización del estado real de ESP
│   ├── features/
│   │   ├── control/
│   │   │   ├── page.js         Arranque y conexión de Control
│   │   │   ├── controller.js   Órdenes, cola y prioridad de DETENER
│   │   │   ├── joystick.js     Entrada táctil, ratón y teclado
│   │   │   ├── device.js       Diagnóstico ESP y eventos de conexión
│   │   │   ├── commands.js     Mapeo de direcciones y funciones
│   │   │   ├── function-state.js Persistencia y telemetría de botones
│   │   │   └── ui.js           Indicadores, mensajes y estados visuales
│   │   ├── voice/              Micrófono, planes y ejecución validada de voz
│   │   ├── monitoring/page.js
│   │   └── admin/page.js
│   └── dev/mock.js             Simulación exclusiva de preview
├── api/
│   ├── control.mjs             Función de control para Vercel
│   ├── backend.mjs             Función REST para Vercel
│   └── voice.mjs               Transcripción e interpretación OpenAI
├── server/
│   ├── control-gateway.mjs     Control con la clave privada del servidor
│   ├── backend-gateway.mjs     Lecturas y administración con rutas limitadas
│   ├── voice-catalog.mjs       Lectura de demos activas para la IA
│   └── voice-gateway.mjs       Servicio privado OpenAI, sin órdenes directas
├── scripts/dev-server.mjs      Servidor local
├── tests/
│   ├── controller.test.mjs     Cancelación, cola y respuestas tardías
│   ├── reactivity.test.mjs     Dirección, duración y liberación del joystick
│   ├── function-state.test.mjs Conservación de estados y telemetría
│   ├── gateway.test.mjs        Validación del control y aislamiento de la clave
│   ├── backend-gateway.test.mjs Rutas REST y acceso administrativo
│   ├── device.test.mjs         Conexión ESP separada de ready
│   ├── microphone.test.mjs     Grabaciones cortas, señal y silencio
│   ├── voice-sequence.test.mjs Demos, planes ordenados y cancelación
│   └── voice.test.mjs          Interpretación, límites y cancelación de voz
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

Las pruebas actuales verifican cancelación, respuestas tardías, estados de botones, validación de acciones e aislamiento de secretos. No sustituyen una prueba del dispositivo físico.

Consulta [Configuración de la clave](docs/DESPLIEGUE.md) y [Mejoras propuestas](docs/MEJORAS.md). El despliegue y la conexión real requieren configurar la variable del servidor.

## Conexión real de la tarjeta ESP

El indicador **Tarjeta ESP** usa `GET /vehiculos/{id}/dispositivo` cada cinco segundos y los eventos WSS `DISPOSITIVO_CONECTADO`, `DISPOSITIVO_DESCONECTADO` y `ESTADO_DISPOSITIVO`. Muestra Conectada, Desconectada o Sin verificar. Una respuesta REST antigua no sobrescribe un evento WSS más reciente.

`GET /api/control` ahora distingue configuración y dispositivo:

```json
{"ready":true,"vehicle":1,"esp_connected":true}
```

`ready` confirma que la clave de control está configurada; `esp_connected` refleja lo que informa EC2. Puede ser `false` o `null` si no fue posible comprobarlo. Ninguno confirma por sí solo el movimiento físico de los motores.

## Control por voz con OpenAI

El botón **Voz IA** abre un panel sin cambiar el tamaño de Control. Permite grabar hasta quince segundos o escribir una instrucción con hasta seis acciones: **enciende la placa**, **avanza un segundo y gira a la derecha otro segundo**, **ejecuta la demo seleccionada** o **alto**. El audio se envía a OpenAI cuando termina la grabación; el micrófono se libera al finalizar, cancelar, cerrar o cambiar de pestaña. Se necesita HTTPS o localhost y permiso del micrófono; el texto funciona sin micrófono.

Selecciona la entrada en **Micrófono de entrada**, pulsa **Grabar voz** y habla cuando aparezca **Escuchando**. La barra muestra el nivel capturado y el reproductor permite escuchar la última grabación localmente. Las grabaciones sin señal o demasiado cortas se explican antes de enviarlas; al iniciar otra instrucción se limpia la transcripción anterior. La transcripción recibe una indicación explícita de español.

Flujo: grabación → `/api/voice` → transcripción OpenAI → Responses API con una función estricta → validación local → el mismo controlador y `/api/control` que los joysticks. El modelo no recibe la clave IoT ni puede elegir URLs, rutas, identificadores o comandos fuera del catálogo. El servidor de voz interpreta; no envía movimientos directamente a EC2.

Agrega en Vercel, dentro del mismo proyecto y entorno Production:

| Variable | Valor |
|---|---|
| `OPENAI_API_KEY` | Clave privada de tu proyecto de OpenAI, independiente de IOT_API_KEY |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-transcribe` (opcional; valor predeterminado) |
| `OPENAI_INTENT_MODEL` | `gpt-4.1-mini` (opcional; valor predeterminado) |

Realiza un nuevo despliegue. Para desarrollo agrega estas variables a tu `.env.local`, conservando las existentes. No subas claves a GitHub ni las pongas en el código del navegador. `GET /api/voice` informa si la clave de voz está configurada; no la muestra ni valida su cuota. El uso real requiere una cuenta API de OpenAI con acceso a los modelos y cuota disponible y puede generar cargos.

La voz ejecuta hasta **seis acciones ordenadas por instrucción**. Cada movimiento admite 50–5000 ms; sin duración se solicitan 1000 ms. El controlador espera la duración restante de cada paso, confirma la parada y continúa con el siguiente; si EC2 ya esperó esa duración, no la espera otra vez. Una parada fallida, desconexión, acción manual, DETENER, cierre del panel o cambio de pestaña cancela los pasos pendientes. El panel muestra el progreso y marca los pasos cancelados. Los joysticks conservan su comportamiento de una sola orden por dirección.

**Enciende la placa**, **apaga la tarjeta**, **enciende el ESP** y **apaga el vehículo** usan el mismo comando y botón `ENCENDER_APAGAR`. Sonido y luces también usan el estado solicitado, sin volver a alternar un botón que ya tenía ese estado. La interfaz refleja las órdenes aceptadas; el estado físico requiere telemetría.

Las demos se identifican por nombre, `id_demo` o **la demo seleccionada** en la consola. Por ejemplo: **ejecuta la demo de maniobra**, **ejecuta la demo 1** y **cancela la demo**. El servidor consulta las demos activas de `IOT_VEHICLE_ID` y restringe la selección de la IA a esos identificadores. El navegador comprueba también su catálogo antes de ejecutar. Una demo puede ejecutarse sola o cerrar una secuencia; no se encadenan movimientos después de una demo porque su duración la controla el backend. Recarga la consola después de crear o eliminar demos. DETENER y cancelar la demo siguen disponibles sin exigir una ESP verificada.

El botón rojo **DETENER AHORA** del panel llama al controlador inmediatamente. La palabra escrita alto evita consultar al modelo; una parada hablada requiere primero transcripción y no reemplaza al botón de emergencia.

La función limita texto a 600 caracteres y audio a 768 KB; aplica un límite de 12 solicitudes/minuto por origen IP en cada instancia. Ese contador en memoria no constituye un límite global de facturación; configura límites de uso en tu proyecto OpenAI y autenticación de operadores antes de abrir el servicio a terceros. El panel mantiene el acceso público solicitado para Control.

Módulos nuevos: `src/features/voice/{panel,executor,contract,microphone}.js`, `src/features/control/device.js`, `src/shared/device-status.js`, `api/voice.mjs`, `server/voice-gateway.mjs` y `server/voice-catalog.mjs`. Las pruebas de ESP, voz y señal del micrófono están en `tests/device.test.mjs`, `tests/voice.test.mjs`, `tests/voice-sequence.test.mjs` y `tests/microphone.test.mjs`.

Referencias oficiales: [Transcripción de audio](https://developers.openai.com/api/docs/guides/speech-to-text), [Function calling](https://developers.openai.com/api/docs/guides/function-calling).

Pruebas locales sin servicios reales: `npm test` y `npm run preview`. La vista de prueba simula ESP y la interpretación con reglas fijas, no usa OpenAI. Abre `index.html?esp=off` para simular una tarjeta desconectada.

## Control móvil por giroscopio

En móviles y tabletas, Control muestra **Activar giroscopio**. Requiere HTTPS (o localhost), sensor de orientación, permisos de movimiento si el navegador los solicita y ESP conectada. Sostén el dispositivo en una postura cómoda al activarlo: la primera lectura define el centro. Inclina hacia delante para avanzar, hacia atrás para retroceder y hacia los lados para desplazamiento lateral. Al volver al centro se envía DETENER. La pala y la rotación conservan el joystick derecho.

**Desactivar giroscopio**, DETENER, un control manual, Voz IA, girar la pantalla, salir de la página, perder conexión o dejar de recibir lecturas desactiva este modo. No se reactiva automáticamente. La zona neutra y la histéresis evitan cambios por pequeñas vibraciones. Cada inclinación mantiene una sola orden de hasta cinco segundos; después hay que volver al centro para continuar. No se guardan permisos ni lecturas en el servidor.

Módulos: `src/features/control/gyroscope.js` (permisos y botón), `src/features/control/tilt-control.js` (calibración y control). Pruebas: `tests/gyroscope.test.mjs`.
