# 🎯 Sistema de Campañas Personalizadas Mejorado

## 📋 Resumen de Mejoras Implementadas

Se ha mejorado completamente el sistema de campañas personalizadas en **https://web.whats-flow.com/dashboard/campaigns** con las siguientes características:

---

## ✨ Nuevas Funcionalidades

### 1. **Sistema de Plantillas de Mensajes** 📝

Se han creado **3 plantillas predeterminadas** que puedes usar en tus campañas:

#### **Plantilla 1 - Recordatorio Formal**
```
Señor {nombre}, le recordamos el vencimiento de su cuota. Le recomendamos pagar en fecha a fin de evitar cargos por mora. Atentamente, la empresa.
```

#### **Plantilla 2 - Recordatorio Amigable**
```
Hola {nombre} 👋, te recordamos que tu pago de {dato1} vence el {dato2}. ¡Gracias por tu confianza! 😊
```

#### **Plantilla 3 - Recordatorio con Datos**
```
Estimado/a {nombre}, su cuota #{dato1} por valor de {dato2} vence el día {dato3}. Para cualquier consulta, estamos a su disposición. 📱💰
```

**Características:**
- Selecciona una plantilla al crear una campaña
- Personaliza el mensaje usando variables: `{nombre}`, `{dato1}`, `{dato2}`, `{dato3}`, `{fecha}`
- También puedes escribir mensajes completamente personalizados
- Las plantillas están disponibles para todas las sesiones

---

### 2. **Configuración de Recordatorios Programados** ⏰

En el botón **"Configuración"**, ahora puedes establecer:

#### **Cuándo enviar el recordatorio:**
- ✅ **En el mismo día** del vencimiento
- ✅ **1 día antes** del vencimiento
- ✅ **2 días antes** del vencimiento
- ✅ **3 días antes** del vencimiento
- ✅ **1 semana antes** del vencimiento

**Ejemplo:**
- Si cargas una fecha de vencimiento: **30/11/2025**
- Y configuras: **"1 día antes"**
- El mensaje se enviará: **29/11/2025**

---

### 3. **Horarios de Envío Inteligentes** 🕐

#### **Horario de Oficina:**
Los mensajes **SOLO se envían entre las 07:00 y 18:00 horas** por defecto.

Puedes personalizar estos horarios en la configuración:
- **Hora de inicio:** 07:00 (modificable)
- **Hora de fin:** 18:00 (modificable)

**Beneficio:** Evita enviar mensajes en horarios inapropiados que puedan molestar a tus clientes.

---

### 4. **Intervalos Aleatorios entre Mensajes** 🎲

Para evitar patrones repetitivos y que los envíos parezcan más naturales, cada mensaje se envía con un **intervalo aleatorio**.

#### **Configuración por defecto:**
- **Mínimo:** 60 segundos (1 minuto)
- **Máximo:** 120 segundos (2 minutos)

#### **Ejemplo de envíos:**
```
Mensaje 1: 13:01
Mensaje 2: 13:03
Mensaje 3: 13:05
Mensaje 4: 13:08
Mensaje 5: 13:10
Mensaje 6: 13:13
```

Cada mensaje sale en un horario diferente de forma aleatoria dentro del rango configurado.

**Puedes modificar estos intervalos** en la configuración (de 1 a 600 segundos).

---

## 📊 Formato del Archivo Excel

El Excel debe contener las siguientes columnas:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| **numero** | Número con código de país | 573001234567 |
| **nombre** | Nombre del contacto | Juan Pérez |
| **dato1** | Dato personalizado (monto, cuota, etc.) | $150.000 |
| **dato2** | Dato personalizado (número de cuota, etc.) | Cuota #3 |
| **dato3** | Dato personalizado (producto, servicio, etc.) | Producto ABC |
| **fecha** | **Fecha de VENCIMIENTO** (YYYY-MM-DD) | 2025-11-30 |
| **hora** | Hora específica de envío (opcional) HH:MM | 09:00 |

### 📥 Plantilla de Excel

Descarga la plantilla de ejemplo usando el botón **"Descargar Plantilla Excel"** en el módulo de campañas.

---

## 🎯 Cómo Funciona el Sistema

### **Paso 1: Configurar Recordatorios**
1. Haz clic en el botón **"Configuración"**
2. Selecciona cuándo enviar los recordatorios (ej: 1 día antes)
3. Define el horario de envío (ej: 07:00 - 18:00)
4. Configura el intervalo aleatorio entre mensajes
5. Guarda la configuración

### **Paso 2: Crear Campaña**
1. Haz clic en **"Nueva Campaña"**
2. Ingresa un nombre para la campaña
3. Carga tu archivo Excel con las fechas de vencimiento
4. Selecciona una plantilla o escribe tu mensaje personalizado
5. (Opcional) Adjunta un archivo multimedia
6. Crea la campaña

### **Paso 3: Envío Automático**
El sistema verificará cada minuto:
- Si es el día configurado para enviar el recordatorio
- Si está dentro del horario permitido (07:00 - 18:00)
- Enviará los mensajes con intervalos aleatorios

---

## 🔧 Base de Datos Actualizada

Se han creado dos nuevas tablas:

### **1. message_templates**
Almacena las plantillas de mensajes personalizadas.

### **2. campaign_settings**
Almacena la configuración de envíos por sesión:
- Días antes del vencimiento
- Horario de inicio y fin
- Intervalos mínimos y máximos entre mensajes

---

## 🚀 APIs Creadas

### **Plantillas:**
- `GET /api/message-templates/:sessionId` - Obtener plantillas
- `POST /api/message-templates/create` - Crear plantilla
- `PUT /api/message-templates/:templateId` - Actualizar plantilla
- `DELETE /api/message-templates/:templateId` - Eliminar plantilla

### **Configuración:**
- `GET /api/message-templates/settings/:sessionId` - Obtener configuración
- `POST /api/message-templates/settings/save` - Guardar configuración

### **Campañas (actualizadas):**
- Ahora respetan la configuración de recordatorios
- Envían mensajes en horarios aleatorios
- Calculan automáticamente la fecha de envío basada en la fecha de vencimiento

---

## 📱 Variables Disponibles en los Mensajes

Al crear o editar un mensaje, puedes usar las siguientes variables que se reemplazarán automáticamente:

- `{nombre}` - Nombre del contacto
- `{dato1}` - Primer dato personalizado del Excel
- `{dato2}` - Segundo dato personalizado del Excel
- `{dato3}` - Tercer dato personalizado del Excel
- `{fecha}` - Fecha de vencimiento del Excel

**Ejemplo:**
```
Hola {nombre}, tu pago de {dato1} vence el {fecha}.
```

Se convierte en:
```
Hola Juan Pérez, tu pago de $150.000 vence el 2025-11-30.
```

---

## ✅ Beneficios del Sistema Mejorado

1. **Envíos Naturales:** Los intervalos aleatorios evitan que WhatsApp detecte patrones de spam
2. **Horarios Apropiados:** Solo envía en horario de oficina (configurable)
3. **Recordatorios Inteligentes:** Envía automáticamente antes del vencimiento
4. **Plantillas Reutilizables:** Ahorra tiempo con mensajes predefinidos
5. **Personalización Total:** Usa variables para mensajes únicos
6. **Fácil de Usar:** Interfaz intuitiva y configuración simple

---

## 🎨 Interfaz Mejorada

- Botón **"Configuración"** en el header para acceder a ajustes
- Selector de plantillas al crear campañas
- Mensajes informativos sobre horarios y recordatorios
- Vista previa de contactos antes de crear la campaña

---

## 📝 Notas Importantes

1. **Fecha en Excel:** Es la fecha de VENCIMIENTO, no la fecha de envío
2. **Cálculo Automático:** El sistema calcula cuándo enviar según tu configuración
3. **Hora Opcional:** Si no especificas hora, usará el horario de inicio configurado
4. **Verificación Automática:** El sistema revisa cada minuto si hay mensajes por enviar
5. **Horario Estricto:** No se enviarán mensajes fuera del rango 07:00 - 18:00 (o tu configuración)

---

## 🔄 Próximos Pasos

Para usar el sistema mejorado:

1. Accede a: **https://web.whats-flow.com/dashboard/campaigns**
2. Haz clic en **"Configuración"** para establecer tus preferencias
3. Descarga la plantilla de Excel
4. Crea tu primera campaña con recordatorios automáticos

---

## 💡 Ejemplo de Uso Completo

**Escenario:** Recordatorios de pago de mensualidades

1. **Configuración:**
   - Recordatorio: 2 días antes
   - Horario: 09:00 - 17:00
   - Intervalo: 60-180 segundos

2. **Excel:**
   ```
   numero         | nombre      | dato1     | dato2    | dato3  | fecha      | hora
   573001234567   | Juan Pérez  | $150.000  | Cuota #3 | Plan A | 2025-11-30 | 10:00
   ```

3. **Plantilla seleccionada:** Plantilla 2

4. **Resultado:**
   - El mensaje se enviará el **28/11/2025** (2 días antes)
   - Entre las 09:00 y 17:00 horas
   - Con intervalos aleatorios de 60 a 180 segundos entre cada mensaje

---

## 🎉 ¡Sistema Listo para Usar!

Todas las mejoras están **activas y funcionando** en producción.

**URL:** https://web.whats-flow.com/dashboard/campaigns

---

*Fecha de implementación: 25 de Noviembre de 2025*
*Sistema: WhatsFlow - Campañas Personalizadas v2.0*
