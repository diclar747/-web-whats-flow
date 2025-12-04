# ✨ Sistema de Plantillas de Campañas - Documentación Completa

## 🎯 Resumen

Sistema completo de gestión de plantillas personalizadas para campañas de WhatsApp con reemplazo automático de variables, progreso en tiempo real y tiempos de envío configurables.

---

## ✅ Funcionalidades Implementadas

### 🎨 **Frontend - Interfaz de Usuario**

#### 1. **Botones en Formulario de Campaña**
- **Botón "Plantillas"** (verde WhatsApp)
  - Abre dialog con plantillas disponibles
  - Ubicación: Paso 3 - Mensaje
  
- **Botón "Crear Plantilla"**
  - Abre dialog para crear plantilla personalizada
  - Permite categorizar la plantilla

#### 2. **Dialog de Plantillas**
- Grid responsive de tarjetas (2 columnas en pantallas medianas)
- Cada tarjeta muestra:
  - Nombre de la plantilla
  - Categoría (chip de color)
  - Vista previa del mensaje
  - Botón "Usar" (verde WhatsApp)
  - Botón "Eliminar" (solo para plantillas personalizadas)
- Mensaje informativo si no hay plantillas

#### 3. **Dialog Crear Plantilla**
- Campos:
  - **Nombre**: Título de la plantilla
  - **Categoría**: Selector con opciones predefinidas
  - **Mensaje**: Campo de texto multilinea
- Variables soportadas mostradas en alerta informativa
- Botones: Cancelar y Crear

#### 4. **Categorías Disponibles**
- General
- Saludos
- Recordatorios
- Marketing
- Seguimiento
- Pagos

---

### 🔧 **Backend - API y Base de Datos**

#### 1. **Tabla `campaign_templates`**
```sql
CREATE TABLE campaign_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  category VARCHAR(100) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone_number)
);
```

#### 2. **Plantillas Predefinidas**
| Nombre | Mensaje | Categoría |
|--------|---------|-----------|
| Saludo Personalizado | Hola {nombre}, ¿cómo estás? Te escribo de WhatsFlow | saludos |
| Recordatorio | Hola {nombre}, este es un recordatorio importante | recordatorios |
| Promoción | Hola {nombre}! Tenemos una promoción especial | marketing |
| Seguimiento | Hola {nombre}, ¿cómo te fue? | seguimiento |

#### 3. **Endpoints REST**

**GET** `/api/campaign-templates/:sessionId`
- Obtiene todas las plantillas del usuario + plantillas globales
- Respuesta: `{ success: true, data: [...templates] }`

**POST** `/api/campaign-templates/:sessionId`
- Crea una nueva plantilla personalizada
- Body: `{ name, message_template, category, description }`
- Respuesta: `{ success: true, data: { id } }`

**DELETE** `/api/campaign-templates/:sessionId/:templateId`
- Elimina una plantilla personalizada
- Solo plantillas del usuario (no globales)
- Respuesta: `{ success: true }`

---

## 🔄 **Sistema de Variables**

### Variables Soportadas

| Variable | Reemplazo | Ejemplo |
|----------|-----------|---------|
| `{nombre}` | Nombre del contacto | "Juan Pérez" |
| `{name}` | Alias de {nombre} | "Juan Pérez" |
| `{telefono}` | Número de teléfono | "595985768793" |
| `{phone}` | Alias de {telefono} | "595985768793" |

### Proceso de Reemplazo

1. **Al crear campaña**: Usuario escribe mensaje con variables
2. **Al enviar**: Backend consulta datos del contacto en BD
3. **Antes de enviar**: Variables reemplazadas automáticamente
4. **Mensaje final**: Personalizado por contacto

```javascript
// Ejemplo de reemplazo
Mensaje original: "Hola {nombre}, tu número es {telefono}"
Contacto: { name: "Juan", jid: "595985768793@s.whatsapp.net" }
Mensaje enviado: "Hola Juan, tu número es 595985768793"
```

---

## 📊 **Progreso en Tiempo Real**

### Actualización de Progreso

- **Antes**: Actualizaba cada 5 mensajes
- **Ahora**: Actualiza en cada mensaje enviado
- **Socket.IO**: Emite evento `campaign-progress`

```javascript
io.to(`session-${sessionId}`).emit('campaign-progress', {
  campaignId,
  sent: sentCount,
  failed: failedCount,
  total: recipients.length
});
```

### Visualización en UI

- Barra de progreso visual
- Texto: "Enviando... X%"
- Contador: "X/Y mensajes"

---

## ⚙️ **Configuraciones de Envío**

### 1. **Tiempos Aleatorios** (`use_random_timing`)

Distribuye mensajes en un período de tiempo aleatorio para parecer más natural.

**Configuración:**
- `random_timing_msg_count`: Cantidad de mensajes
- `random_timing_time_span_minutes`: Período en minutos

**Ejemplo:**
```
10 mensajes en 60 minutos = 1 mensaje cada ~6 minutos (aleatorio)
```

### 2. **ID Flow** (`use_id_flow`)

Agrega un identificador único al final de cada mensaje.

**Configuración:**
- `id_flow_size`: Longitud del ID (default: 32)

**Ejemplo:**
```
Mensaje: "Hola Juan, ¿cómo estás?"

Con ID Flow:
"Hola Juan, ¿cómo estás?

ID: abc123xyz789def456ghi789jkl012mn"
```

### 3. **Delay Fijo**

Si no se usa timing aleatorio:
- Delay: 2-5 segundos entre mensajes
- Previene bloqueos de WhatsApp

---

## 🎮 **Flujo de Uso**

### Crear Campaña con Plantilla

1. **Ir a Campañas** → Botón "Nueva Campaña"
2. **Paso 1**: Nombre y tipo de campaña
3. **Paso 2**: Seleccionar contactos
4. **Paso 3**: Mensaje
   - Click en **"Plantillas"** (verde)
   - Seleccionar plantilla deseada
   - Click en **"Usar"**
   - Mensaje se carga automáticamente
   - Modificar si es necesario
5. **Paso 4**: Configuraciones opcionales
6. **Crear y Enviar**

### Crear Plantilla Personalizada

1. **En paso de mensaje** → Click "Crear Plantilla"
2. **Completar formulario**:
   - Nombre: "Mi Saludo Especial"
   - Categoría: "Saludos"
   - Mensaje: "Hola {nombre}, bienvenido a mi negocio"
3. **Click "Crear Plantilla"**
4. **Plantilla disponible** para futuras campañas

---

## 🐛 **Problemas Resueltos**

### ✅ 1. Variables no se reemplazaban
**Solución**: Agregado reemplazo automático en backend antes de enviar

### ✅ 2. Progreso no se actualizaba
**Solución**: Socket.IO emite en cada mensaje (antes cada 5)

### ✅ 3. JIDs sin formato correcto
**Solución**: Función `normalizeJid()` agrega `@s.whatsapp.net`

### ✅ 4. Campañas no ejecutaban
**Solución**: Map de control `runningCampaigns` + verificación `shouldStop`

### ✅ 5. No había botón "Reanudar"
**Solución**: Endpoint `/resume` + estado `paused` + UI condicional

---

## 📝 **Ejemplos de Uso**

### Ejemplo 1: Recordatorio de Pago

```
Plantilla:
"Hola {nombre}, te recordamos tu pago pendiente. 
Contáctanos al {telefono} para más información."

Resultado para Juan (595985768793):
"Hola Juan, te recordamos tu pago pendiente. 
Contáctanos al 595985768793 para más información."
```

### Ejemplo 2: Promoción

```
Plantilla:
"¡Hola {nombre}! 🎉
Tenemos una oferta especial solo para ti.
Responde a este mensaje para más detalles."

Resultado para María:
"¡Hola María! 🎉
Tenemos una oferta especial solo para ti.
Responde a este mensaje para más detalles."
```

### Ejemplo 3: Seguimiento

```
Plantilla:
"Hola {nombre}, ¿cómo te fue con el producto?
Nos encantaría conocer tu opinión."

Resultado para Pedro:
"Hola Pedro, ¿cómo te fue con el producto?
Nos encantaría conocer tu opinión."
```

---

## 🚀 **Comandos Útiles**

```bash
# Reiniciar servidor
pm2 restart whatsflow-server

# Ver logs
pm2 logs whatsflow-server

# Ver plantillas en BD
mysql -u root -p whatsflow -e "SELECT * FROM campaign_templates;"

# Limpiar cache del navegador
Ctrl + Shift + R (Chrome/Firefox)
Cmd + Shift + R (Mac)
```

---

## 📊 **Estructura de Datos**

### Objeto Plantilla

```typescript
interface Template {
  id: number;
  phone_number: string;  // Usuario o 'ALL' para globales
  name: string;
  message_template: string;
  description?: string;
  category: string;
  created_at: string;
  updated_at: string;
}
```

### Objeto Campaña

```typescript
interface Campaign {
  id: number;
  name: string;
  message_template: string;
  use_random_timing: boolean;
  random_timing_msg_count?: number;
  random_timing_time_span_minutes?: number;
  use_id_flow: boolean;
  id_flow_size?: number;
  status: 'draft' | 'sending' | 'paused' | 'completed';
}
```

---

## 🎯 **Próximas Mejoras (Sugerencias)**

- [ ] Editar plantillas existentes
- [ ] Duplicar plantillas
- [ ] Exportar/Importar plantillas
- [ ] Estadísticas de uso de plantillas
- [ ] Variables personalizadas adicionales ({empresa}, {producto}, etc.)
- [ ] Vista previa en tiempo real con datos de contacto
- [ ] Plantillas con multimedia (imágenes, videos)
- [ ] Compartir plantillas entre usuarios
- [ ] Categorías personalizadas

---

## 📞 **Soporte**

Para problemas o sugerencias:
- Revisar logs: `pm2 logs whatsflow-server`
- Verificar BD: Tabla `campaign_templates`
- Limpiar cache del navegador
- Revisar consola del navegador (F12)

---

**Versión**: 1.0.0  
**Fecha**: 4 de Diciembre 2025  
**Estado**: ✅ Completamente Funcional
