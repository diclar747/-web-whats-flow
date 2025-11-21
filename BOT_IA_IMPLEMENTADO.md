# 🤖 BOT CON IA - IMPLEMENTACIÓN COMPLETA

## ✅ ESTADO: FUNCIONANDO

El bot con IA ha sido implementado correctamente usando **DeepSeek AI**.

---

## 🎯 CÓMO FUNCIONA

### 1. **Dos Modos de Operación**

#### A. Flujo Programado (Keywords)
- El usuario escribe palabras clave específicas
- El bot responde con mensajes pre-programados
- Respuestas fijas: texto, imágenes, videos, menús, etc.

#### B. Flujo con IA (Inteligente)
- El bot entiende **cualquier mensaje** en lenguaje natural
- Genera respuestas personalizadas usando IA
- Aprende del contexto del negocio que le proporcionas

---

## 🚀 CREAR UN BOT CON IA

### Paso 1: Ir a Chatbot → Tab Flujos
![Tab Flujos](flujos.png)

### Paso 2: Click en "Crear Flujo"
Se abre un diálogo con 2 opciones:

```
┌─────────────────────────────────────┐
│   🤖 Bot con IA   │ 📝 Flujo Programado │
└─────────────────────────────────────┘
```

### Paso 3: Seleccionar "Bot con IA"

### Paso 4: Llenar el Formulario

**Campos requeridos:**
- **Nombre del flujo:** Ej: "Asistente Virtual"
- **Descripción:** Breve descripción

**Información del Negocio (IMPORTANTE):**
```
Empresa: Mi Tienda Online
Productos: Ropa, accesorios, calzado
Horarios: Lunes a Viernes 9am-6pm, Sábados 10am-2pm
Dirección: Calle Principal 123, Ciudad
Políticas: 
  - Envíos gratis sobre $50
  - Devoluciones en 30 días
Formas de pago: Efectivo, tarjetas, transferencia
Preguntas frecuentes:
  - ¿Hacen envíos? Sí, a toda la ciudad
  - ¿Cuánto demora? 24-48 horas
  - ¿Tienen tienda física? Sí, en Calle Principal 123
```

**O extraer desde tu sitio web:**
- Pegar la URL de tu sitio
- Click en "Extraer"
- El sistema extrae automáticamente el contenido

### Paso 5: Click en "Crear Flujo"

---

## 💬 CÓMO RESPONDE EL BOT

### Flujo Programado:
```
Cliente: "hola"
Bot: "¡Hola! ¿En qué puedo ayudarte?"  ← Respuesta fija
```

### Flujo con IA:
```
Cliente: "hola"
Bot: "¡Hola! Bienvenido a Mi Tienda Online. ¿En qué puedo ayudarte hoy?"

Cliente: "tienen camisas?"
Bot: "Sí, tenemos una amplia variedad de camisas. ¿Buscas algo específico como estilo, color o talla?"

Cliente: "hacen envios a zona sur?"
Bot: "Sí, hacemos envíos a toda la ciudad, incluyendo zona sur. El envío es gratis en compras mayores a $50 y demora entre 24-48 horas."

Cliente: "cuanto cuesta una camisa?"
Bot: "Los precios de nuestras camisas varían según el modelo. Te recomiendo visitarnos en nuestra tienda en Calle Principal 123 o puedes consultarme sobre algún modelo específico. Nuestro horario es de lunes a viernes 9am-6pm y sábados 10am-2pm."
```

**La IA entiende contexto y responde inteligentemente basándose en la información del negocio.**

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### API Utilizada:
- **Proveedor:** DeepSeek AI
- **Modelo:** deepseek-chat
- **Endpoint:** https://api.deepseek.com/v1/chat/completions

### Configuración en Backend:
**Archivo:** `src/server/routes/chatbot.js`

**Línea 787:** API Key configurada
```javascript
'Authorization': 'Bearer sk-1a63bb1681514e0982ab42b0a13377c8'
```

### Flujo de Procesamiento:

```
1. WhatsApp recibe mensaje
   ↓
2. src/server/index.js (línea 4771)
   → POST /api/chatbot/process-message
   ↓
3. src/server/routes/chatbot.js (línea 447)
   → Verifica si bot está habilitado
   → Busca flujos activos
   ↓
4. ¿Es flujo con IA?
   SÍ → Llama a DeepSeek API (línea 584)
   NO  → Retorna respuesta programada
   ↓
5. Construye contexto con:
   - Información del negocio
   - Contenido extraído del sitio
   - Prompt del sistema
   ↓
6. DeepSeek genera respuesta
   ↓
7. Respuesta se envía por WhatsApp
```

### Parámetros de IA Configurables:
- **Temperature:** 0.7 (creatividad de respuestas)
- **Max Tokens:** 500 (longitud máxima de respuesta)

---

## 📊 PRIORIDAD DE RESPUESTAS

El sistema tiene una lógica inteligente:

```
1. PRIMERO: Busca flujos programados con keywords exactas
   Ejemplo: Si escriben "hola" y hay un flujo con esa keyword
   → Responde con el flujo programado

2. SEGUNDO: Si no hay match, busca flujos con IA activos
   → Usa IA para responder cualquier mensaje

3. TERCERO: Si no hay nada, no responde
```

Esto permite tener **control total**:
- Respuestas específicas para ciertas keywords
- IA para todo lo demás

---

## 🎨 INTERFAZ VISUAL

Los flujos se distinguen visualmente:

```
┌──────────────────────────────────┐
│ 📋 Preguntas Frecuentes   [🔵 IA] │
│ Responde automáticamente FAQ      │
│ ✓ Datos: ✓  ✓ Web: ✓             │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 👋 Saludo  [</> Programado]      │
│ Responde a saludos básicos        │
│ Keywords: hola, buenos días       │
└──────────────────────────────────┘
```

- **Chip Verde con 🧠:** Flujo con IA
- **Chip Azul con </>:** Flujo Programado

---

## ✅ VENTAJAS DEL BOT CON IA

### 1. **Responde a TODO**
No necesitas programar cada pregunta posible.

### 2. **Contexto del Negocio**
La IA conoce tu negocio y responde coherentemente.

### 3. **Natural y Humano**
Las respuestas son naturales, no robóticas.

### 4. **Aprende del Contenido**
Extrae info de tu sitio web automáticamente.

### 5. **Ahorra Tiempo**
No necesitas crear 100 flujos programados.

---

## 🔄 ACTUALIZAR INFORMACIÓN

Si cambias horarios, productos, precios:

1. Ir a Tab Flujos
2. Click en editar (✏️) el flujo con IA
3. Actualizar información del negocio
4. Click "Guardar Cambios"

¡La IA empezará a usar la nueva información inmediatamente!

---

## ⚠️ CONSIDERACIONES

### Costos de API:
- DeepSeek cobra por tokens usados
- Cada respuesta consume ~100-500 tokens
- Monitorea el uso en tu cuenta de DeepSeek

### Rate Limits:
- DeepSeek tiene límites de requests por minuto
- Si hay mucho tráfico, considera agregar rate limiting

### Calidad de Respuestas:
- Depende de la calidad de la información proporcionada
- Más detalle = Mejores respuestas
- Prueba y ajusta la información según sea necesario

---

## 🧪 PROBAR EL BOT

### 1. Asegúrate que está habilitado:
```
Tab Configuración → Switch "Habilitar Chatbot" → ON
```

### 2. Asegúrate que el flujo está activo:
```
Tab Flujos → Switch del flujo → ON
```

### 3. Envía un mensaje a tu WhatsApp:
```
"Hola, quisiera información sobre sus productos"
```

### 4. Verifica los logs:
```bash
pm2 logs whatsflow-server --lines 50
```

Deberías ver:
```
[CHATBOT] 🤖 Generando respuesta con IA para: "..."
[CHATBOT] 🤖 IA respondió: ...
```

---

## 🐛 TROUBLESHOOTING

### El bot no responde:
1. ✅ Verifica que el bot esté habilitado (Tab Configuración)
2. ✅ Verifica que el flujo esté activo
3. ✅ Revisa los logs: `pm2 logs whatsflow-server`

### Error de IA:
```
[CHATBOT] ❌ Error con IA: ...
```

**Posibles causas:**
- API Key inválida
- Sin créditos en DeepSeek
- Rate limit excedido
- Timeout de red

**Solución:**
- Verifica tu cuenta en DeepSeek
- Revisa los logs para el error exacto

### Respuestas genéricas:
Si la IA da respuestas muy genéricas:
- Agrega más información del negocio
- Sé más específico en la descripción
- Agrega FAQs comunes

---

## 📈 MÉTRICAS

El sistema registra:
- Total de interacciones
- Respuestas exitosas
- Flujos más usados
- Última activación

Ver en: **Tab Analytics**

---

## 🔒 SEGURIDAD

La API Key está en el código por ahora. Para producción:

**IMPORTANTE:**
```bash
# Mover la key a .env
echo "DEEPSEEK_API_KEY=sk-1a63bb1681514e0982ab42b0a13377c8" >> .env

# Luego en el código usar:
process.env.DEEPSEEK_API_KEY
```

---

## 📚 RECURSOS

- **DeepSeek Docs:** https://platform.deepseek.com/docs
- **Pricing:** https://platform.deepseek.com/pricing
- **API Status:** https://status.deepseek.com

---

## ✨ PRÓXIMAS MEJORAS

1. **Historial de conversación** - Que la IA recuerde el contexto
2. **Múltiples idiomas** - Detectar y responder en el idioma del cliente
3. **Integración con base de datos** - Consultar precios/stock en tiempo real
4. **Transferencia inteligente** - Si la IA no puede responder, transferir a agente
5. **A/B Testing** - Comparar rendimiento IA vs Programado

---

**Fecha:** 22 de Noviembre 2025  
**Estado:** ✅ Funcionando  
**Versión:** 1.0

---

## 🎉 ¡LISTO PARA USAR!

Tu bot con IA está configurado y listo. Solo necesitas:
1. Crear un flujo con IA
2. Proporcionar información del negocio
3. Activar el bot
4. ¡Disfrutar respuestas inteligentes automáticas!
