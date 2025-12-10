-- Limpiar plan de prueba
DELETE FROM subscription_plans WHERE plan_name = 'basico';

-- Insertar los planes correctos
INSERT INTO subscription_plans (plan_name, plan_display_name, duration_days, price, max_users, max_messages_per_month, max_campaigns, max_contacts, status) VALUES
('estandar', 'Estándar', 30, 160000.00, 2, 999999, 999999, 999999, 'active'),
('manager', 'Manager', 30, 320000.00, 5, 999999, 999999, 999999, 'active'),
('comercial', 'Comercial', 30, 720000.00, 10, 999999, 999999, 999999, 'active'),
('ejecutivo', 'Ejecutivo', 30, 1250000.00, 15, 999999, 999999, 999999, 'active'),
('corporativo', 'Corporativo', 30, 2500000.00, 25, 999999, 999999, 999999, 'active');

-- Verificar
SELECT * FROM subscription_plans;
