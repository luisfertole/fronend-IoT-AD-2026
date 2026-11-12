# Mejoras recomendadas

| Prioridad | Mejora | Beneficio | Requiere |
|---|---|---|---|
| Alta | Telemetría de encendido, luces y sonido | Estado físico sincronizado entre sesiones y operadores | Backend + firmware |
| Alta | Watchdog y parada por pérdida de conexión | Detener motores aunque el navegador deje de responder | Firmware |
| Alta | Secuencia e idempotencia de órdenes | Impedir movimientos tardíos después de emergencia | Backend + firmware |
| Alta | Sesiones, roles y control exclusivo por operador | Evitar órdenes simultáneas contradictorias | Backend |
| Alta | Resolver WSS 404 si persiste | Recuperar eventos del servidor real | EC2 y proxy |
| Media | Editor visual de pasos de DEMO | Configurar secuencias sin Swagger | Frontend y contrato backend |
| Media | Edición de vehículos, comandos y DEMO | Completar administración | Endpoints PUT/PATCH |
| Media | Telemetría completa con versión y resincronización | Complementar la persistencia de sesión ya implementada con estado físico y otros operadores | Backend + frontend |
| Media | Auditoría y límites de solicitudes | Rastrear órdenes y contener uso excesivo | Backend/gateway |
| Media | Latencia y conexión física del dispositivo | Diferenciar servidor disponible y vehículo conectado | Backend + firmware |
| Baja | Filtros por fecha y exportación del historial | Analizar operaciones | Backend + frontend |
| Baja | Pruebas de interfaz en CI | Detectar regresiones visuales y de accesibilidad | Navegador de pruebas + CI |

El diseño utiliza CSS modular propio sin depender de CDN. Figma puede servir para documentar componentes como archivo de diseño; no es una librería que se instale en la web. Si se incorpora Bootstrap más adelante, conviene verificar que sus estilos de tarjetas no cambien los colores del texto.
