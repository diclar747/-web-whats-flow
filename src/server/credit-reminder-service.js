/**
 * SISTEMA DE RECORDATORIOS DE CRÉDITOS - SERVICIO AUTOMÁTICO
 * 
 * Servicio que verifica periódicamente y envía recordatorios
 * de cuotas por WhatsApp según la configuración
 */

class CreditReminderService {
    constructor(pool, io, whatsAppSessions) {
        this.pool = pool;
        this.io = io;
        this.whatsAppSessions = whatsAppSessions;
        this.isRunning = false;
        this.checkInterval = null;
        this.checkIntervalMs = 5 * 60 * 1000; // Verificar cada 5 minutos
    }
    
    /**
     * Iniciar el servicio de recordatorios
     */
    start() {
        if (this.isRunning) {
            console.log('[CREDIT-REMINDER] Servicio ya está en ejecución');
            return;
        }
        
        this.isRunning = true;
        console.log('[CREDIT-REMINDER] 🚀 Iniciando servicio de recordatorios...');
        
        // Ejecutar inmediatamente y luego cada 5 minutos
        this.checkAndSendReminders();
        this.checkInterval = setInterval(() => {
            this.checkAndSendReminders();
        }, this.checkIntervalMs);
    }
    
    /**
     * Detener el servicio
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('[CREDIT-REMINDER] ⏹️ Servicio detenido');
    }
    
    /**
     * Verificar y enviar recordatorios pendientes
     */
    async checkAndSendReminders() {
        const startTime = Date.now();
        console.log('[CREDIT-REMINDER] 🔍 Verificando recordatorios pendientes...');
        
        try {
            // 1. Recordatorios antes del vencimiento
            await this.sendBeforeDueReminders();
            
            // 2. Recordatorios el día del vencimiento
            await this.sendOnDueReminders();
            
            // 3. Notificaciones de cuotas vencidas
            await this.sendOverdueReminders();
            
            // 4. Actualizar estados de cuotas vencidas
            await this.updateOverdueStatus();
            
            const duration = Date.now() - startTime;
            console.log(`[CREDIT-REMINDER] ✅ Verificación completada en ${duration}ms`);
        } catch (error) {
            console.error('[CREDIT-REMINDER] ❌ Error en verificación:', error);
        }
    }
    
    /**
     * Enviar recordatorios antes del vencimiento
     */
    async sendBeforeDueReminders() {
        try {
            // Buscar cuotas que vencen en X días y no tienen recordatorio enviado
            const [installments] = await this.pool.execute(
                `SELECT 
                    ci.id as installment_id,
                    ci.credit_id,
                    ci.installment_number,
                    ci.amount,
                    ci.due_date,
                    ci.reminder_sent,
                    c.session_id,
                    c.contact_jid,
                    c.contact_name,
                    c.reminder_days_before,
                    c.reminder_template_id,
                    DATEDIFF(ci.due_date, CURDATE()) as days_until_due
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE ci.status = 'pending'
                 AND c.status = 'active'
                 AND ci.reminder_sent = FALSE
                 AND ci.due_date > CURDATE()
                 AND DATEDIFF(ci.due_date, CURDATE()) = c.reminder_days_before
                 LIMIT 50`
            );
            
            console.log(`[CREDIT-REMINDER] 📨 ${installments.length} recordatorios "antes del vencimiento" pendientes`);
            
            for (const installment of installments) {
                await this.sendReminder(installment, 'before_due', installment.reminder_days_before);
            }
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error en recordatorios before_due:', error);
        }
    }
    
    /**
     * Enviar recordatorios el día del vencimiento
     */
    async sendOnDueReminders() {
        try {
            // Buscar cuotas que vencen hoy y no tienen recordatorio "on_due" enviado
            const [installments] = await this.pool.execute(
                `SELECT 
                    ci.id as installment_id,
                    ci.credit_id,
                    ci.installment_number,
                    ci.amount,
                    ci.due_date,
                    c.session_id,
                    c.contact_jid,
                    c.contact_name,
                    c.installment_count as total_installments,
                    c.reminder_template_id
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE ci.status = 'pending'
                 AND c.status = 'active'
                 AND ci.due_date = CURDATE()
                 AND NOT EXISTS (
                     SELECT 1 FROM credit_reminder_logs crl 
                     WHERE crl.installment_id = ci.id AND crl.reminder_type = 'on_due'
                 )
                 LIMIT 50`
            );
            
            console.log(`[CREDIT-REMINDER] 📨 ${installments.length} recordatorios "día de vencimiento" pendientes`);
            
            for (const installment of installments) {
                await this.sendReminder(installment, 'on_due', 0);
            }
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error en recordatorios on_due:', error);
        }
    }
    
    /**
     * Enviar notificaciones de cuotas vencidas
     */
    async sendOverdueReminders() {
        try {
            // Buscar cuotas vencidas que no tienen notificación de vencimiento
            const [installments] = await this.pool.execute(
                `SELECT 
                    ci.id as installment_id,
                    ci.credit_id,
                    ci.installment_number,
                    ci.amount,
                    ci.due_date,
                    c.session_id,
                    c.contact_jid,
                    c.contact_name,
                    c.installment_count as total_installments,
                    c.reminder_template_id,
                    DATEDIFF(CURDATE(), ci.due_date) as days_overdue
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE ci.status = 'overdue'
                 AND c.status = 'active'
                 AND ci.overdue_notification_sent = FALSE
                 AND DATEDIFF(CURDATE(), ci.due_date) >= 1
                 LIMIT 50`
            );
            
            console.log(`[CREDIT-REMINDER] 📨 ${installments.length} notificaciones de vencimiento pendientes`);
            
            for (const installment of installments) {
                await this.sendReminder(installment, 'overdue', 0);
            }
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error en recordatorios overdue:', error);
        }
    }
    
    /**
     * Actualizar estado de cuotas a "vencida"
     */
    async updateOverdueStatus() {
        try {
            const [result] = await this.pool.execute(
                `UPDATE credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 SET ci.status = 'overdue', ci.updated_at = NOW()
                 WHERE ci.status = 'pending'
                 AND c.status = 'active'
                 AND ci.due_date < CURDATE()`
            );
            
            if (result.affectedRows > 0) {
                console.log(`[CREDIT-REMINDER] ⚠️ ${result.affectedRows} cuotas marcadas como vencidas`);
            }
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error actualizando vencidos:', error);
        }
    }
    
    /**
     * Enviar un recordatorio específico
     */
    async sendReminder(installment, reminderType, daysBefore) {
        try {
            console.log(`[CREDIT-REMINDER] 📤 Enviando recordatorio ${reminderType} para cuota ${installment.installment_number} de ${installment.contact_name}`);
            
            // Obtener plantilla
            const template = await this.getTemplate(installment, reminderType);
            
            // Preparar variables
            const variables = {
                nombre: installment.contact_name?.split(' ')[0] || 'Cliente',
                monto: this.formatCurrency(installment.amount),
                cuota_numero: installment.installment_number,
                total_cuotas: installment.total_installments || installment.installment_count,
                fecha_vencimiento: this.formatDate(installment.due_date),
                credito_descripcion: ''
            };
            
            // Generar mensaje
            const message = this.replaceVariables(template.message_text, variables);
            
            // Enviar por WhatsApp
            const sendResult = await this.sendWhatsAppMessage(
                installment.session_id,
                installment.contact_jid,
                message
            );
            
            // Guardar log
            await this.pool.execute(
                `INSERT INTO credit_reminder_logs 
                 (installment_id, credit_id, session_id, contact_jid, reminder_type, 
                  days_before, message_text, template_used, whatsapp_message_id, status, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    installment.installment_id,
                    installment.credit_id,
                    installment.session_id,
                    installment.contact_jid,
                    reminderType,
                    daysBefore,
                    message,
                    template.id,
                    sendResult.messageId,
                    sendResult.success ? 'sent' : 'failed',
                    sendResult.error || null
                ]
            );
            
            // Actualizar estado de recordatorio en la cuota
            if (reminderType === 'before_due') {
                await this.pool.execute(
                    'UPDATE credit_installments SET reminder_sent = TRUE, reminder_sent_at = NOW(), reminder_count = reminder_count + 1 WHERE id = ?',
                    [installment.installment_id]
                );
            } else if (reminderType === 'overdue') {
                await this.pool.execute(
                    'UPDATE credit_installments SET overdue_notification_sent = TRUE, overdue_notification_sent_at = NOW() WHERE id = ?',
                    [installment.installment_id]
                );
            }
            
            console.log(`[CREDIT-REMINDER] ✅ Recordatorio ${reminderType} enviado a ${installment.contact_name}`);
            
            // Emitir evento por socket
            if (this.io) {
                this.io.to(`session-${installment.session_id}`).emit('credit-reminder-sent', {
                    installmentId: installment.installment_id,
                    creditId: installment.credit_id,
                    type: reminderType,
                    contactName: installment.contact_name,
                    success: sendResult.success
                });
            }
            
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error enviando recordatorio:', error);
        }
    }
    
    /**
     * Obtener la plantilla apropiada
     */
    async getTemplate(installment, reminderType) {
        try {
            // Primero intentar usar la plantilla configurada para el crédito
            if (installment.reminder_template_id) {
                const [templates] = await this.pool.execute(
                    'SELECT * FROM credit_templates WHERE id = ? AND is_active = TRUE',
                    [installment.reminder_template_id]
                );
                if (templates.length > 0) {
                    return templates[0];
                }
            }
            
            // Buscar plantilla por tipo
            const [templates] = await this.pool.execute(
                `SELECT * FROM credit_templates 
                 WHERE (session_id = ? OR session_id = 'default')
                 AND reminder_type = ?
                 AND is_active = TRUE
                 ORDER BY session_id DESC, is_default DESC
                 LIMIT 1`,
                [installment.session_id, reminderType]
            );
            
            if (templates.length > 0) {
                return templates[0];
            }
            
            // Plantilla por defecto
            return {
                id: 'default',
                message_text: `Hola {nombre}! 👋\n\nTe recordamos que tienes una cuota pendiente:\n\n💰 *Monto:* Gs. {monto}\n📊 *Cuota:* {cuota_numero} de {total_cuotas}\n📅 *Vencimiento:* {fecha_vencimiento}\n\n¡Gracias por tu preferencia! 😊`
            };
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error obteniendo plantilla:', error);
            return {
                id: 'default',
                message_text: `Hola {nombre}! 👋\n\nTe recordamos que tienes una cuota pendiente:\n\n💰 *Monto:* Gs. {monto}\n📊 *Cuota:* {cuota_numero} de {total_cuotas}\n📅 *Vencimiento:* {fecha_vencimiento}`
            };
        }
    }
    
    /**
     * Enviar mensaje de WhatsApp
     */
    async sendWhatsAppMessage(sessionId, contactJid, message) {
        try {
            // Obtener la sesión de WhatsApp
            const sock = this.whatsAppSessions?.get(sessionId);
            
            if (!sock) {
                return {
                    success: false,
                    error: 'Sesión de WhatsApp no disponible'
                };
            }
            
            // Enviar mensaje
            const result = await sock.sendMessage(contactJid, { text: message });
            
            return {
                success: true,
                messageId: result?.key?.id
            };
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error enviando WhatsApp:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Reemplazar variables en el mensaje
     */
    replaceVariables(text, variables) {
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return result;
    }
    
    /**
     * Formatear moneda
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-PY', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
    
    /**
     * Formatear fecha
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-PY', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
    
    /**
     * Enviar recordatorio manual (para uso desde API)
     */
    async sendManualReminder(installmentId, customMessage = null) {
        try {
            // Obtener información de la cuota
            const [installments] = await this.pool.execute(
                `SELECT 
                    ci.id as installment_id,
                    ci.credit_id,
                    ci.installment_number,
                    ci.amount,
                    ci.due_date,
                    c.session_id,
                    c.contact_jid,
                    c.contact_name,
                    c.installment_count as total_installments,
                    c.reminder_template_id
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE ci.id = ?`,
                [installmentId]
            );
            
            if (installments.length === 0) {
                return { success: false, error: 'Cuota no encontrada' };
            }
            
            const installment = installments[0];
            
            // Preparar mensaje
            let message = customMessage;
            if (!message) {
                const template = await this.getTemplate(installment, 'before_due');
                const variables = {
                    nombre: installment.contact_name?.split(' ')[0] || 'Cliente',
                    monto: this.formatCurrency(installment.amount),
                    cuota_numero: installment.installment_number,
                    total_cuotas: installment.total_installments,
                    fecha_vencimiento: this.formatDate(installment.due_date)
                };
                message = this.replaceVariables(template.message_text, variables);
            }
            
            // Enviar
            const result = await this.sendWhatsAppMessage(
                installment.session_id,
                installment.contact_jid,
                message
            );
            
            return result;
        } catch (error) {
            console.error('[CREDIT-REMINDER] Error en envío manual:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = CreditReminderService;
