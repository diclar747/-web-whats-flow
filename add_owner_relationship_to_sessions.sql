-- Agregar campo owner_phone_number para establecer relación con el usuario master
-- Este campo indica qué usuario principal (quien hizo login) es el dueño de esta sesión

ALTER TABLE user_sessions 
ADD COLUMN owner_phone_number VARCHAR(50) NULL AFTER phone_number,
ADD INDEX idx_owner_phone (owner_phone_number);

-- Comentario: 
-- - owner_phone_number: NULL para sesiones principales (las que iniciaron sesión originalmente)
-- - owner_phone_number: número del master para sesiones secundarias (conectadas por QR dentro del panel)
-- - Permite rastrear qué sesiones pertenecen a cada usuario principal

-- Actualizar sesiones existentes activas para que sean principales (owner_phone_number = NULL indica sesión principal)
-- Las sesiones activas actuales se consideran principales por defecto
UPDATE user_sessions 
SET owner_phone_number = NULL 
WHERE is_active = 1;

-- Marcar sesiones inactivas antiguas como huérfanas (pueden limpiarse después)
UPDATE user_sessions 
SET owner_phone_number = 'orphan' 
WHERE is_active = 0 AND owner_phone_number IS NULL;
