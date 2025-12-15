## Objetivo
- Rediseñar la landing a un estilo moderno y orientado a ventas, manteniendo el inicio por QR como flujo principal.
- Mostrar claramente todos los módulos: campañas (incluye programadas), chatbot con IA, calendarios inteligentes, historial, reportes por estados, API REST, múltiples conexiones y seguimiento.

## Estado actual
- Landing existente con QR funcional en `src/client/src/components/LandingPage.tsx`.
- Rutas en `src/client/src/App.tsx` donde `"/"` y `"/home"` renderizan `LandingPage` si no hay `sessionId`.
- QR y sesión manejados mediante Socket.IO y endpoints:
  - Front: `LandingPage.tsx` gestiona `qr-code`, `connection-update`, `whatsapp-connected` y polling (`/api/session/:sessionId/status`).
  - Back: `src/server/index.js` define `GET /api/qr-status`, `POST /api/create-session`, `GET /api/session/:sessionId/status`, etc.

## Alcance del rediseño
- Mantener intacto el flujo de conexión por QR (no tocar lógica de sockets ni endpoints).
- Reorganizar la UI para que el QR quede destacado al inicio y el resto de contenidos se presenten en secciones modernas, visuales y explicativas.
- Añadir imágenes ilustrativas para cada módulo, almacenadas en `src/client/public/`.

## Nueva estructura de la Landing
1. Hero con QR (sticky/visible)
   - Título persuasivo y subtítulo.
   - Bloque de QR con estado de carga, instrucción de escaneo y botón “Generar QR” (ya existe, se mantiene).
   - CTA secundario: “Acceder como Agente”.
2. Por qué WhatsFlow
   - Beneficios clave (automatización con IA, ahorro de tiempo, escalabilidad, soporte multi-equipo).
   - Copy tipo vendedor experto: “Este sistema no puede faltar en su empresa”.
3. Módulos (grid de tarjetas)
   - Campañas masivas y programadas.
   - Chatbot con IA.
   - Calendarios inteligentes.
   - Historial y análisis de conversaciones.
   - Reportes por estado.
   - API REST.
   - Múltiples conexiones (multi-dispositivo/sesiones).
   - Seguimiento/kanban de contactos.
   - Cada tarjeta con icono, breve descripción y una imagen.
4. Detalle de módulos (secciones 2 columnas)
   - Imagen a la izquierda/derecha + descripción breve y bullets de uso.
   - Links internos a documentación o a secciones del dashboard cuando aplique.
5. Cómo funciona
   - Timeline simple: Generar QR → Escanear → Conectar → Gestionar → Medir.
6. Integraciones y API
   - Explicación breve de la API REST con endpoints típicos y casos de uso.
7. Testimonios/Confianza (opcional si tenemos logos)
   - Logos o frases breves.
8. CTA final
   - Botón destacado “Conectar con QR” que enfoca el bloque del QR.

## Contenido e Imágenes
- Añadir imágenes en `src/client/public/` y referenciarlas como `/campaigns.png`, `/chatbot-ia.png`, `/calendario.png`, `/historial.png`, `/reportes.png`, `/api-rest.png`, `/multi-conexiones.png`, `/seguimiento.png`.
- Optimizar peso y tamaños (WebP/PNG), usar `img` con `loading="lazy"`.

## Copys por módulo (breve)
- Campañas: envíos masivos, segmentación, plantillas; programador con calendario.
- Chatbot con IA: respuestas contextuales, flujos asistidos, handoff a humano.
- Calendarios inteligentes: reservas, recordatorios, reprogramaciones automáticas.
- Historial: toda la conversación centralizada, búsqueda avanzada, etiquetas.
- Reportes por estados: métricas de conversión y SLA, embudos por estado.
- API REST: integración con ERP/CRM, webhooks, mensajería transaccional.
- Múltiples conexiones: varias sesiones/ dispositivos, equipos paralelos.
- Seguimiento: kanban de leads, etapas y automatizaciones.

## Preservar QR
- No modificar:
  - Eventos Socket.IO en `LandingPage.tsx` (`qr-code`, `connection-update`, `whatsapp-connected`, `auth_token`).
  - Polling y almacenamiento en `sessionStorage` (`whatsflow_session`, `whatsflow_device_id`).
- Solo cambios de presentación (layout/estilos/duplicación del CTA).

## Implementación técnica
- Mantener MUI v5 y la paleta actual (`#0f172a`, `#1e293b`, acentos `#6366f1`).
- Crear subsecciones estilizadas dentro de `LandingPage.tsx` para evitar romper rutas.
- Extraer arrays de módulos a constantes para fácil mantenimiento.
- Añadir animaciones suaves (`transition`, `transform`, `boxShadow`) ya usadas en tarjetas.
- Referenciar imágenes desde `public` y asegurar paths absolutos.

## Entregables
- Landing renovada en `src/client/src/components/LandingPage.tsx` con nuevas secciones y contenido.
- Imágenes colocadas en `src/client/public/` con nombres definidos.
- Copy actualizado con enfoque comercial.

## Validación
- Probar conexión QR: auto generación, escaneo y redirección al dashboard.
- Verificar que agentes puedan acceder vía `/login` sin interferir con QR.
- Confirmar carga diferida de imágenes y correcta visualización en móviles.
- Revisar Lighthouse básico (performance/SEO) y que no se rompan rutas (`"/"`, `"/home"`).

¿Confirmo este plan y procedo a implementar el rediseño y agregar las imágenes?