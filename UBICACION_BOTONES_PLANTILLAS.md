# 📍 Ubicación de Botones de Plantillas

## 🎯 Dónde Encontrar los Botones

### **Paso a Paso:**

1. **Ir a Módulo de Campañas**
   - Click en "Campañas" en el menú lateral

2. **Click en "Nueva Campaña"** (botón verde con ícono +)

3. **Completar Paso 1** - Información Básica
   - Nombre de la campaña
   - Tipo (Directa o Programada)

4. **Completar Paso 2** - Seleccionar Contactos
   - Elegir contactos o grupos

5. **AQUÍ ESTÁN LOS BOTONES → Paso 3 - Mensaje**

---

## �� Ubicación Exacta en Paso 3

```
┌─────────────────────────────────────────────────┐
│  PASO 3: MENSAJE                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  📋 Variables disponibles:                      │
│  {nombre} - Se reemplaza por el nombre...      │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [📄 Plantillas]  [⚙️ Crear Plantilla]   │  │ ← AQUÍ ESTÁN
│  │ [😊]  [📎]  [{nombre}]                   │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Mensaje de la campaña:                   │  │
│  │ ___________________________________      │  │
│  │ |                                 |      │  │
│  │ | Hola {nombre}, como estas?     |      │  │
│  │ |_________________________________|      │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  [Adjuntar archivo]                             │
│                                                 │
│  [< Anterior]               [Siguiente >]       │
└─────────────────────────────────────────────────┘
```

---

## 🔵 Botón "Plantillas" (Verde)

**Aspecto:**
- Color: Verde WhatsApp (#00a884)
- Ícono: 📄 (Description)
- Texto: "Plantillas"

**Función:**
- Abre dialog modal con plantillas disponibles
- Muestra plantillas predefinidas + personalizadas
- Click en "Usar" para aplicar plantilla

---

## ⚙️ Botón "Crear Plantilla" (Borde)

**Aspecto:**
- Color: Outline (borde)
- Ícono: ⚙️ (Settings)
- Texto: "Crear Plantilla"

**Función:**
- Abre dialog para crear nueva plantilla
- Guardar plantilla para uso futuro
- Reutilizable en otras campañas

---

## 📸 Otros Botones en la Misma Fila:

1. **😊 Emoji** - Selector de emojis
2. **📎 Adjuntar** - Subir archivos multimedia
3. **{nombre}** - Insertar variable de nombre

---

## ✅ Orden de Aparición (De izquierda a derecha):

```
[📄 Plantillas]  [⚙️ Crear Plantilla]  [😊]  [📎]  [{nombre}]
     ↓                    ↓              ↓     ↓       ↓
   Verde              Outline         Icono  Icono  Botón
  WhatsApp                                           pequeño
```

---

## 🎬 Flujo de Uso:

### **Opción 1: Usar Plantilla Existente**

```
1. Click "Plantillas" (verde)
   ↓
2. Se abre modal con tarjetas de plantillas
   ↓
3. Click "Usar" en la plantilla deseada
   ↓
4. Mensaje se carga automáticamente
   ↓
5. Editar si es necesario
   ↓
6. Continuar con campaña
```

### **Opción 2: Crear Nueva Plantilla**

```
1. Click "Crear Plantilla"
   ↓
2. Se abre formulario:
   - Nombre
   - Categoría
   - Mensaje
   ↓
3. Click "Crear Plantilla"
   ↓
4. Plantilla guardada
   ↓
5. Aparece en "Plantillas" para uso futuro
```

---

## 🔍 Si No Ves los Botones:

1. **Limpia cache del navegador:**
   - Chrome/Firefox: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Verifica que estás en el paso correcto:**
   - Debe ser el **Paso 3 - Mensaje**
   - Los botones están **arriba del campo de texto**

3. **Recarga la página:**
   - F5 o refresca completamente

4. **Verifica que el servidor está actualizado:**
   ```bash
   pm2 restart whatsflow-server
   ```

---

## 📱 Vista en Móvil/Tablet:

Los botones se apilan verticalmente en pantallas pequeñas:

```
┌─────────────────────┐
│ [📄 Plantillas]     │
│ [⚙️ Crear Plantilla]│
│ [😊] [📎] [{nombre}]│
└─────────────────────┘
```

---

## ✨ Características Visuales:

**Botón "Plantillas":**
- ✅ Fondo verde sólido
- ✅ Texto blanco
- ✅ Efecto hover (más oscuro)
- ✅ Ícono de documento

**Botón "Crear Plantilla":**
- ✅ Solo borde (outline)
- ✅ Sin fondo
- ✅ Ícono de configuración
- ✅ Efecto hover

---

**Última actualización:** 4 Diciembre 2025
**Versión:** 1.0.0
