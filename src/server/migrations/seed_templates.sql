-- Insertar plantillas predefinidas para sistema de campañas personalizadas
-- Ejecutar con: mysql -u root whatsflow < seed_templates.sql

USE whatsflow;

-- Limpiar plantillas existentes (opcional)
-- DELETE FROM campaign_templates_predefined;

-- Insertar 5 plantillas predefinidas
INSERT INTO campaign_templates_predefined (name, category, message_text, variables, is_active) 
VALUES 
('Recordatorio Simple', 'simple', 'Hola {nombre}! 👋

Te recordamos que tienes un pago pendiente de Gs. {monto}.

📅 Vencimiento: día {fecha_vencimiento}

¡Gracias por tu preferencia! 😊', '["nombre", "monto", "fecha_vencimiento"]', TRUE),

('Recordatorio Formal', 'formal', 'Estimado/a {nombre},

Le informamos que registra un saldo pendiente de Gs. {monto} con fecha de vencimiento el día {fecha_vencimiento} de este mes.

Por favor, regularice su situación a la brevedad.

Saludos cordiales. 📋', '["nombre", "monto", "fecha_vencimiento"]', TRUE),

('Recordatorio Urgente', 'urgent', '⚠️ RECORDATORIO URGENTE ⚠️

{nombre}, su pago de Gs. {monto} vence el día {fecha_vencimiento}.

💳 Evite recargos realizando su pago HOY.

Para consultas, contáctenos. 📞', '["nombre", "monto", "fecha_vencimiento"]', TRUE),

('Recordatorio con Cuotas', 'installments', 'Hola {nombre}! 👋

Recordatorio de cuota:
💰 Monto: Gs. {monto}
📊 Cuotas pendientes: {cuotas_pendientes}
📅 Vencimiento: día {fecha_vencimiento}

¡Gracias por mantenerte al día! 🙏', '["nombre", "monto", "fecha_vencimiento", "cuotas_pendientes"]', TRUE),

('Recordatorio Previo (3 días antes)', 'simple', '{nombre}, te recordamos que en 3 días vence tu pago de Gs. {monto}.

📅 Vence: día {fecha_vencimiento}

Evita recargos pagando con anticipación. ✅', '["nombre", "monto", "fecha_vencimiento"]', TRUE);

-- Verificar inserción
SELECT * FROM campaign_templates_predefined WHERE is_active = TRUE;
