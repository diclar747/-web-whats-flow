# 🧪 PRUEBA DE CAMPAÑAS PROGRAMADAS

## Guía de Prueba Rápida

### 1️⃣ Preparar Excel de Prueba

Crea un archivo Excel con estas columnas y datos de prueba:

| numero        | nombre  | dato1      | dato2   | dato3    | fecha      | hora  |
|--------------|---------|------------|---------|----------|------------|-------|
| 595999999999 | Test1   | Producto1  | $100    | Info1    | 2025-12-08 | 09:00 |
| 595999999998 | Test2   | Producto2  | $200    | Info2    | 2025-12-10 | 14:30 |
| 595999999997 | Test3   | Producto3  | $150    | Info3    | 2025-12-12 | 16:00 |

### 2️⃣ Crear Campaña

1. Ir a **Campañas Personalizadas**
2. Click en **"Nueva Campaña"**
3. Completar:
   - **Nombre:** "Test Campaña Programada"
   - **Mensaje:** "Hola {nombre}, recordatorio sobre {dato1} por {dato2}"
   - **Cargar Excel** con los datos de arriba
4. Click en **"Crear Campaña"**

### 3️⃣ Verificar Estado PROGRAMADA

La tarjeta de la campaña debe mostrar:

```
✅ Estado: PROGRAMADA (chip naranja con icono de reloj)
✅ Alert informativo con:
   📅 Envíos programados
   Desde: 08/12/2025 09:00
   Hasta: 12/12/2025 16:00
✅ Estadísticas:
   - Total: 3
   - Enviados: 0
   - Pendientes: 3
   - Errores: 0
✅ Progreso: 0% (barra vacía)
```

### 4️⃣ Ver Detalles

Click en **"Ver Detalles / Mensaje"**

Debe mostrar:
```
✅ Título: Test Campaña Programada
✅ Estado: PROGRAMADA (chip naranja)
✅ Tarjetas de estadísticas modernas con gradientes
✅ Mensaje completo visible
✅ Barra de progreso grande: 0 de 3 mensajes enviados (0%)
✅ Tabla con 3 contactos
✅ Cada contacto muestra:
   - Número, nombre, datos
   - Fecha y hora específica
   - Estado: PENDIENTE (chip naranja con icono de reloj)
```

### 5️⃣ Simular Envío

Para simular que se envió un mensaje (opcional):

```sql
-- En MySQL
USE whatsflow;

-- Obtener el ID de la campaña recién creada
SELECT id, name, contacts FROM campaigns WHERE type='personalized' ORDER BY created_at DESC LIMIT 1;

-- Copiar el ID y actualizar manualmente un contacto
UPDATE campaigns 
SET contacts = JSON_REPLACE(
    contacts, 
    '$[0].estado', 'enviado',
    '$[0].enviadoEn', NOW()
),
progress_sent = 1,
status = 'active'
WHERE id = 'TU_CAMPAIGN_ID_AQUI';
```

Luego en el navegador:
1. Refrescar la página (F5)
2. La campaña ahora debe mostrar:
   - Estado: ACTIVA (chip verde)
   - Enviados: 1
   - Pendientes: 2
   - Progreso: 33%

### 6️⃣ Simular Finalización

```sql
-- Marcar todos como enviados
UPDATE campaigns 
SET contacts = JSON_REPLACE(
    JSON_REPLACE(
        JSON_REPLACE(
            contacts,
            '$[0].estado', 'enviado'
        ),
        '$[1].estado', 'enviado'
    ),
    '$[2].estado', 'enviado'
),
progress_sent = 3,
status = 'completed'
WHERE id = 'TU_CAMPAIGN_ID_AQUI';
```

La campaña debe mostrar:
- Estado: COMPLETADA (chip azul)
- Enviados: 3
- Pendientes: 0
- Progreso: 100% (barra verde completa)

### 7️⃣ Probar Reprogramar

1. Click en **"Reprogramar"**
2. Confirmar acción
3. Verificar que:
   - Estado vuelve a PROGRAMADA
   - Enviados: 0
   - Pendientes: 3
   - Progreso: 0%
   - Todos los contactos vuelven a PENDIENTE

## ✅ Checklist de Verificación

- [ ] La campaña se crea correctamente
- [ ] Estado inicial es PROGRAMADA (no PENDING)
- [ ] Se muestran las fechas de envío en la tarjeta
- [ ] El diálogo de detalles muestra datos correctos
- [ ] La barra de progreso funciona correctamente
- [ ] Los estados de contactos son visibles (pendiente/enviado/error)
- [ ] El progreso llega a 100% al completar
- [ ] La reprogramación funciona correctamente
- [ ] No aparece "PENDING[201~" en ningún lado

## 🐛 Problemas Comunes

### Problema: Aparece "PENDING" en lugar de "PROGRAMADA"
**Solución:** Limpiar caché del navegador (Ctrl+Shift+R)

### Problema: No se muestran las fechas
**Solución:** Verificar que el Excel tenga fechas futuras

### Problema: El progreso no se actualiza
**Solución:** Verificar que el cron job esté activo:
```bash
pm2 logs whatsflow-server | grep "check-scheduled"
```

### Problema: Ver Detalles muestra campañas incorrectas
**Solución:** Ya corregido - el backend ahora filtra por campaignId

## 📝 Notas

- Las campañas programadas se revisan cada minuto por el cron job
- Los mensajes se envían solo en el horario configurado (07:00 - 18:00 por defecto)
- Se respeta la fecha y hora específica de cada contacto
- Los intervalos entre mensajes son aleatorios para evitar bloqueos

---

**Fecha:** 05 de Diciembre de 2025
**Estado:** ✅ Todas las correcciones aplicadas
