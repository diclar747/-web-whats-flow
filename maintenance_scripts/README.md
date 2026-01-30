# Scripts de Mantenimiento y Diagnóstico

Este directorio centraliza todos los scripts que se han creado para realizar tareas de mantenimiento, limpieza, diagnóstico o reparaciones urgentes en el sistema.

El objetivo de centralizarlos es:
1.  **Tener un inventario claro** de las intervenciones manuales que requiere el sistema.
2.  **Documentar su propósito** para reducir la dependencia del conocimiento individual.
3.  **Facilitar su futura refactorización** y reemplazo por lógica de negocio robusta dentro de la aplicación.

**ADVERTENCIA:** Ejecutar estos scripts sin entender su impacto puede causar problemas en la base de datos.

---

## Listado de Scripts (En Proceso de Documentación)

### Scripts SQL

-   **`add_owner_relationship_to_sessions.sql`**:
    -   **Propósito:** Modifica la tabla `user_sessions` para añadir una columna `owner_phone_number`.
    -   **Función:** Intenta establecer una relación entre una sesión de dispositivo (ej. WhatsApp) y la cuenta de usuario principal que la generó. Marca las sesiones existentes como "principales" o "huérfanas" para una posible limpieza.
    -   **Análisis:** Script crítico que evidencia la falta de una relación de clave foránea `user_id` en la tabla `user_sessions`.

-   **`... (otros scripts .sql por documentar)`**

### Scripts NodeJS (.js)

-   **`cleanup_user_sessions.js`**:
    -   **Propósito:** Elimina registros incorrectos de la tabla `user_sessions`.
    -   **Función:** Borra filas que corresponden a sesiones de autenticación de la aplicación (usuarios logueados con email) que fueron insertadas erróneamente en la tabla destinada a sesiones de dispositivos (WhatsApp).
    -   **Análisis:** Demuestra que hay una confusión o error en la lógica de manejo de sesiones, mezclando dos conceptos diferentes en la misma tabla.

-   **`... (otros scripts .js por documentar)`**
