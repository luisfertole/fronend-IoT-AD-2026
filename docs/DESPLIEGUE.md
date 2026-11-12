# Configurar la clave sin compartirla

## En tu equipo

1. Copia `.env.example` a `.env.local` en la raíz.
2. Abre `.env.local` en tu editor y completa `IOT_API_KEY=tu_clave_real`.
3. Ejecuta `npm run dev` y abre http://127.0.0.1:5500.

`.env.local` está excluido de Git y el servidor local no lo sirve. No hace falta enviar la clave por chat.

## En Vercel

En Settings → Environment Variables agrega `IOT_API_KEY`, selecciona los entornos necesarios y vuelve a desplegar. Configura `IOT_API_BASE` e `IOT_VEHICLE_ID` si cambian respecto a `.env.example`. El ID debe coincidir con `VEHICLE_ID` en `src/config/app.js`.

El control es público por la solicitud de operar sin introducir una clave. Si necesitas limitar los operadores, incorpora autenticación o restricciones de acceso del servidor.

| Síntoma | Revisar |
|---|---|
| Configura IOT_API_KEY | Variable ausente o falta un nuevo despliegue. |
| /api/control responde 404 | Alojamiento estático, raíz incorrecta o carpeta api sin desplegar. |
| El servidor rechazó la clave | La clave configurada no coincide con la de EC2. |
| Lecturas públicas fallan | /api/backend debe existir y poder conectarse a IOT_API_BASE desde el servidor. |
| WSS responde 404 | Ruta /ws/vehiculos/{id} y upgrade del proxy en EC2. |
| RDS sin verificar | Falta endpoint seguro de diagnóstico. |
| API acepta pero el dispositivo no responde | Revisar recepción y telemetría del ESP8266. |

Documentación oficial: [Funciones Node](https://vercel.com/docs/functions/runtimes/node-js), [Variables de entorno](https://vercel.com/docs/environment-variables).

## CORS y WebSocket

Las consultas REST se realizan a `/api/backend` dentro del mismo origen del panel. Node/Vercel realiza la conexión con EC2; no se usa `no-cors` ni se desactivan las protecciones del navegador. Para lecturas públicas no se inyecta la clave privada; las escrituras administrativas requieren la clave introducida por el administrador.

El WebSocket sigue conectándose directamente a EC2. Su servidor puede validar el encabezado Origin por separado. Una respuesta `101 Switching Protocols` confirma que aceptó la conexión WebSocket; una lectura REST `200` desde Node no comprueba el CORS del navegador.

Referencia: [CORS en MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
