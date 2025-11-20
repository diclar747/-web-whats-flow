-- Configurar usuario administrador
-- Actualiza el usuario con el número que inicia con 595994854167 como administrador

UPDATE users 
SET 
    is_admin = TRUE,
    admin_phone = phone,
    subscription_plan = 'enterprise',
    subscription_status = 'active',
    subscription_start_date = NOW(),
    subscription_end_date = DATE_ADD(NOW(), INTERVAL 365 DAY),
    subscription_days = 365
WHERE phone LIKE '595994854167%';

-- Verificar el resultado
SELECT 
    id,
    name,
    phone,
    email,
    is_admin,
    subscription_plan,
    subscription_status,
    subscription_end_date,
    DATEDIFF(subscription_end_date, NOW()) as days_remaining
FROM users 
WHERE phone LIKE '595994854167%';
