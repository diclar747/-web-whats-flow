# 📝 Guía de Plantillas Personalizadas

## 🎯 Sistema de Gestión de Plantillas

Las plantillas de mensajes te permiten crear y guardar mensajes reutilizables para tus campañas.

---

## 🆕 Nuevas Funcionalidades Agregadas

### ✨ Gestión Completa de Plantillas

Ahora puedes:

1. ✅ **Ver todas tus plantillas** en un solo lugar
2. ✅ **Crear plantillas personalizadas** con tus propios mensajes
3. ✅ **Editar tus plantillas** cuando lo necesites
4. ✅ **Eliminar plantillas** que ya no uses
5. ✅ **Usar plantillas demo** como ejemplos (no se pueden editar)

---

## 🔧 Cómo Acceder

### **Opción 1: Desde el Header**
En la pantalla de campañas verás el botón:

```
[📝 Mis Plantillas]
```

### **Opción 2: Al Crear una Campaña**
En el selector de plantillas, hay un botón **"Gestionar"** que te lleva al mismo lugar.

---

## 📋 Tipos de Plantillas

### **1. Plantillas Demo** (Etiqueta azul "Demo")
Son ejemplos predefinidos que el sistema incluye para ayudarte:

- **Plantilla 1 - Recordatorio Formal**
- **Plantilla 2 - Recordatorio Amigable** 
- **Plantilla 3 - Recordatorio con Datos**

**Características:**
- ✅ Se pueden usar en tus campañas
- ❌ NO se pueden editar
- ❌ NO se pueden eliminar
- 📚 Son ejemplos para que veas cómo funcionan

### **2. Mis Plantillas** (Sin etiqueta)
Son plantillas que TÚ creas y personalizas:

- ✅ Se pueden usar en tus campañas
- ✅ Se pueden EDITAR cuando quieras
- ✅ Se pueden ELIMINAR si ya no las necesitas
- 🎨 Totalmente personalizables

---

## ➕ Crear una Nueva Plantilla

### **Paso 1: Abrir el Gestor**
1. Clic en **"Mis Plantillas"** en el header
2. O clic en **"Gestionar"** al crear una campaña

### **Paso 2: Crear**
1. Clic en el botón **"Nueva Plantilla"**
2. Llenar el formulario:
   - **Nombre:** Dale un nombre descriptivo
   - **Mensaje:** Escribe tu mensaje

### **Paso 3: Usar Variables**
Haz clic en los botones para insertar variables:

```
[{nombre}] [{dato1}] [{dato2}] [{dato3}] [{fecha}]
```

### **Ejemplo de Plantilla:**

**Nombre:**
```
Recordatorio Cuota Mensual
```

**Mensaje:**
```
Hola {nombre}, te recordamos que tu cuota #{dato1} por 
valor de {dato2} vence el {fecha}. 
Por favor realiza tu pago a tiempo. ¡Gracias! 🙏
```

### **Vista Previa:**
El sistema te muestra cómo se verá el mensaje con datos de ejemplo:
```
Hola Juan Pérez, te recordamos que tu cuota #3 por 
valor de $150.000 vence el 2025-11-30.
Por favor realiza tu pago a tiempo. ¡Gracias! 🙏
```

---

## ✏️ Editar una Plantilla

1. Abre **"Mis Plantillas"**
2. Busca tu plantilla (las que NO tienen etiqueta "Demo")
3. Clic en el ícono del lápiz **✏️**
4. Modifica el nombre o mensaje
5. Clic en **"Actualizar"**

⚠️ **Nota:** Solo puedes editar TUS plantillas, no las plantillas Demo.

---

## 🗑️ Eliminar una Plantilla

1. Abre **"Mis Plantillas"**
2. Busca tu plantilla
3. Clic en el ícono de la papelera **🗑️**
4. Confirma la eliminación

⚠️ **Advertencia:** Esta acción NO se puede deshacer.

---

## 🎨 Variables Disponibles

Puedes usar estas variables en tus plantillas:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{nombre}` | Nombre del contacto | Juan Pérez |
| `{dato1}` | Primera columna del Excel | $150.000 |
| `{dato2}` | Segunda columna del Excel | Cuota #3 |
| `{dato3}` | Tercera columna del Excel | Plan Premium |
| `{fecha}` | Fecha de vencimiento | 2025-11-30 |

---

## 💡 Ejemplos de Plantillas Útiles

### **Plantilla: Recordatorio Simple**
```
Hola {nombre}, te recordamos que tu pago vence el {fecha}. 
¡Gracias!
```

### **Plantilla: Recordatorio con Monto**
```
Estimado/a {nombre}, el monto de {dato1} vence el {fecha}. 
Por favor realiza tu pago para evitar recargos.
```

### **Plantilla: Recordatorio Detallado**
```
Hola {nombre} 👋

Te recordamos:
📌 Concepto: {dato2}
💰 Monto: {dato1}
📅 Vencimiento: {fecha}

Puedes pagar por cualquiera de nuestros medios disponibles.

¡Gracias por tu preferencia! 🙏
```

### **Plantilla: Recordatorio Urgente**
```
⚠️ RECORDATORIO IMPORTANTE ⚠️

{nombre}, tu {dato2} de {dato1} vence HOY {fecha}.

Por favor realiza tu pago cuanto antes para evitar 
intereses por mora.

Gracias.
```

---

## 🔄 Flujo de Trabajo Recomendado

### **1. Crear Plantillas Base**
Crea 2-3 plantillas para diferentes situaciones:
- Una formal (para clientes empresariales)
- Una amigable (para clientes personales)
- Una urgente (para pagos atrasados)

### **2. Usar en Campañas**
Al crear una campaña:
1. Selecciona la plantilla apropiada
2. El mensaje se carga automáticamente
3. Puedes modificarlo si es necesario (solo para esa campaña)

### **3. Actualizar Según Necesites**
Si notas que una plantilla necesita mejoras:
1. Ve a "Mis Plantillas"
2. Edita la plantilla
3. Todas las nuevas campañas usarán la versión actualizada

---

## 📱 Interfaz de Gestión

### **Pantalla Principal: Mis Plantillas**

```
┌─────────────────────────────────────────────────────┐
│  📝 Mis Plantillas de Mensajes    [Nueva Plantilla] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────┐              │
│  │ Plantilla 1 - Recordatorio Formal│ [Demo]       │
│  │ Señor {nombre}, le recordamos... │              │
│  │ (No se puede editar - es ejemplo)│              │
│  └──────────────────────────────────┘              │
│                                                     │
│  ┌──────────────────────────────────┐ ✏️  🗑️      │
│  │ Mi Recordatorio Personalizado    │              │
│  │ Hola {nombre}, tu cuota...       │              │
│  │ (Puedes editar o eliminar)       │              │
│  └──────────────────────────────────┘              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### **Formulario de Crear/Editar**

```
┌─────────────────────────────────────────────┐
│  ➕ Nueva Plantilla                         │
├─────────────────────────────────────────────┤
│                                             │
│  Nombre de la Plantilla:                   │
│  [_____________________________________]   │
│                                             │
│  Mensaje de la Plantilla:                  │
│  [{nombre}] [{dato1}] [{dato2}] ...        │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │  Escribe tu mensaje aquí...         │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Vista Previa:                             │
│  ┌──────────────────────────────────────┐  │
│  │ Hola Juan Pérez, tu cuota...        │  │
│  └──────────────────────────────────────┘  │
│                                             │
│              [Cancelar] [Crear Plantilla]  │
└─────────────────────────────────────────────┘
```

---

## ✅ Ventajas del Sistema

1. **Ahorra Tiempo** - Crea una vez, usa múltiples veces
2. **Consistencia** - Todos los mensajes siguen el mismo formato
3. **Flexibilidad** - Edita cuando necesites
4. **Organización** - Ten todas tus plantillas en un solo lugar
5. **Personalización** - Usa variables para mensajes únicos
6. **Ejemplos Incluidos** - Las plantillas Demo te sirven de guía

---

## 🚀 Integración con Campañas

Al crear una campaña, verás:

```
Plantilla de Mensaje:
┌─────────────────────────────────────┐
│ Seleccionar plantilla...         ▼ │ [Gestionar]
└─────────────────────────────────────┘

Opciones:
├─ Ninguna - Escribir mensaje personalizado
├─ — Plantillas Demo —
│  ├─ Plantilla 1 - Recordatorio Formal (Demo)
│  ├─ Plantilla 2 - Recordatorio Amigable (Demo)
│  └─ Plantilla 3 - Recordatorio con Datos (Demo)
└─ — Mis Plantillas —
   ├─ Mi Recordatorio Personalizado
   ├─ Plantilla de Cobranza
   └─ Recordatorio Urgente
```

---

## 📊 Buenas Prácticas

### ✅ DO (Hacer)
- ✅ Crea plantillas con nombres descriptivos
- ✅ Usa variables para personalizar
- ✅ Prueba tus plantillas antes de usarlas masivamente
- ✅ Mantén tus plantillas actualizadas
- ✅ Crea diferentes plantillas para diferentes situaciones

### ❌ DON'T (No Hacer)
- ❌ No uses nombres genéricos como "Plantilla 1"
- ❌ No pongas información específica que cambia (como fechas exactas)
- ❌ No crees demasiadas plantillas similares
- ❌ No olvides usar las variables disponibles

---

## 🎯 Casos de Uso

### **Caso 1: Empresa de Servicios**
Plantillas para:
- Recordatorios de pago mensuales
- Avisos de corte de servicio
- Confirmaciones de pago recibido

### **Caso 2: Gimnasio**
Plantillas para:
- Recordatorios de cuota mensual
- Avisos de vencimiento de membresía
- Promociones especiales

### **Caso 3: Escuela/Universidad**
Plantillas para:
- Recordatorios de pago de matrícula
- Avisos de vencimiento de pensiones
- Notificaciones de pagos pendientes

---

## 🆘 Solución de Problemas

### **No puedo editar una plantilla**
✅ **Solución:** Solo puedes editar TUS plantillas. Las plantillas con etiqueta "Demo" son ejemplos del sistema y no se pueden editar.

### **No aparecen mis plantillas**
✅ **Solución:** Verifica que creaste plantillas con tu sesión. Las plantillas se guardan por usuario.

### **La variable no se reemplaza**
✅ **Solución:** Asegúrate de escribir correctamente la variable: `{nombre}` (con llaves y en minúscula).

### **Eliminé una plantilla por error**
❌ **No hay solución:** La eliminación es permanente. Tendrás que recrear la plantilla.

---

## 📱 Acceso Rápido

**URL:** https://web.whats-flow.com/dashboard/campaigns

**Botones:**
- **"Mis Plantillas"** - Gestionar todas tus plantillas
- **"Gestionar"** - Acceso rápido desde crear campaña

---

## 🎉 ¡Empieza a Crear!

1. Ve a **"Mis Plantillas"**
2. Clic en **"Nueva Plantilla"**
3. Crea tu primera plantilla personalizada
4. Úsala en tus campañas

**Las plantillas Demo son solo ejemplos. ¡Crea las tuyas propias!**

---

*Última actualización: 25 de Noviembre de 2025*  
*Versión: Plantillas v2.0*
