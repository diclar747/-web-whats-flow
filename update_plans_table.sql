-- Agregar campo admin_phone a la tabla plans para rastrear qué super admin creó el plan
ALTER TABLE plans ADD COLUMN IF NOT EXISTS admin_phone VARCHAR(20) DEFAULT '595994854167';

-- Actualizar los planes existentes para asignarlos al super admin
UPDATE plans SET admin_phone = '595994854167' WHERE admin_phone IS NULL;

-- Verificar la estructura
DESCRIBE plans;

-- Ver los planes actuales
SELECT * FROM plans;
