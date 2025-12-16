/**
 * Endpoints para Campañas Personalizadas con Excel
 * Sistema de cobranza con fechas de vencimiento y estados en tiempo real
 */

const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

// Configuración de multer para archivos Excel
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
        }
    }
});

module.exports = (app, pool) => {

    // ==========================================
    // 1. OBTENER PLANTILLAS PREDEFINIDAS
    // ==========================================
    app.get('/api/campaigns/templates/predefined', async (req, res) => {
        try {
            const [templates] = await pool.execute(
                'SELECT * FROM campaign_templates_predefined WHERE is_active = TRUE ORDER BY category, name'
            );

            res.json({
                success: true,
                templates: templates.map(t => ({
                    ...t,
                    variables: JSON.parse(t.variables || '[]')
                }))
            });
        } catch (error) {
            console.error('[CAMPAIGNS-TEMPLATES] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener plantillas predefinidas'
            });
        }
    });

    // ==========================================
    // 2. PROCESAR Y VALIDAR ARCHIVO EXCEL
    // ==========================================
    app.post('/api/campaigns/personalized/upload-excel', upload.single('excel'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No se proporcionó archivo Excel'
                });
            }

            console.log('[EXCEL-UPLOAD] Procesando archivo:', req.file.originalname);

            // Leer archivo Excel
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            console.log('[EXCEL-UPLOAD] Registros encontrados:', data.length);

            // Validar y normalizar datos
            const preview = [];
            const errors = [];

            data.forEach((row, index) => {
                const rowNumber = index + 2; // +2 porque empieza en fila 1 y hay header
                const record = {};

                // Validar Número (columna A)
                const phoneRaw = row['Número'] || row['Numero'] || row['número'] || row['numero'] || row['Telefono'] || row['Phone'];
                if (!phoneRaw) {
                    errors.push(`Fila ${rowNumber}: Falta el número de teléfono`);
                    return;
                }
                // Limpiar y formatear teléfono
                const phone = String(phoneRaw).replace(/[^0-9]/g, '');
                if (phone.length < 10 || phone.length > 15) {
                    errors.push(`Fila ${rowNumber}: Teléfono inválido (${phoneRaw})`);
                    return;
                }
                record.numero = phone;

                // Validar Nombre (columna B)
                const name = row['Nombre'] || row['nombre'] || row['Name'];
                if (!name || String(name).trim() === '') {
                    errors.push(`Fila ${rowNumber}: Falta el nombre`);
                    return;
                }
                record.nombre = String(name).trim();

                // Validar Monto (columna C)
                const amount = row['Monto'] || row['monto'] || row['Amount'] || row['Deuda'];
                if (!amount || isNaN(parseFloat(amount))) {
                    errors.push(`Fila ${rowNumber}: Monto inválido (${amount})`);
                    return;
                }
                record.monto = parseFloat(amount);

                // Validar Fecha de Vencimiento (columna D) - día del mes
                const dueDay = row['Fecha Vencimiento'] || row['Vencimiento'] || row['Dia Vencimiento'] || row['Due Day'];
                const dueDayNum = parseInt(dueDay);
                if (!dueDay || isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
                    errors.push(`Fila ${rowNumber}: Día de vencimiento inválido (${dueDay}). Debe ser 1-31`);
                    return;
                }
                record.fecha_vencimiento = dueDayNum;

                // Cuotas (columna E) - opcional
                const installments = row['Cuotas'] || row['cuotas'] || row['Installments'];
                record.cuotas = installments ? parseInt(installments) || 1 : 1;

                preview.push(record);
            });

            console.log('[EXCEL-UPLOAD] Registros válidos:', preview.length);
            console.log('[EXCEL-UPLOAD] Errores encontrados:', errors.length);

            res.json({
                success: true,
                preview,
                totalRecords: data.length,
                validRecords: preview.length,
                errors,
                filename: req.file.originalname
            });

        } catch (error) {
            console.error('[EXCEL-UPLOAD] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al procesar archivo Excel: ' + error.message
            });
        }
    });

    // ==========================================
    // 3. CREAR CAMPAÑA PERSONALIZADA
    // ==========================================
    app.post('/api/campaigns/personalized/create', async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { sessionId, name, messageTemplate, templateId, recipients } = req.body;

            if (!sessionId || !name || !messageTemplate || !recipients || !Array.isArray(recipients)) {
                return res.status(400).json({
                    success: false,
                    error: 'Faltan campos obligatorios'
                });
            }

            await connection.beginTransaction();

            // 1. Crear campaña
            const [result] = await connection.execute(
                `INSERT INTO personalized_campaigns 
                (session_id, name, message_template, template_id, status, total_recipients) 
                VALUES (?, ?, ?, ?, 'draft', ?)`,
                [sessionId, name, messageTemplate, templateId || null, recipients.length]
            );

            const campaignId = result.insertId;
            console.log('[CAMPAIGN-CREATE] Campaña creada:', campaignId, 'con', recipients.length, 'destinatarios');

            // 2. Insertar destinatarios
            for (const recipient of recipients) {
                await connection.execute(
                    `INSERT INTO campaign_recipients_detailed 
                    (campaign_id, phone_number, name, amount, due_day, installments, status) 
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                    [
                        campaignId,
                        recipient.phoneNumber || recipient.numero,
                        recipient.name || recipient.nombre,
                        recipient.amount || recipient.monto,
                        recipient.dueDay || recipient.fecha_vencimiento,
                        recipient.installments || recipient.cuotas || 1
                    ]
                );
            }

            await connection.commit();

            res.json({
                success: true,
                campaignId,
                totalRecipients: recipients.length,
                message: 'Campaña creada exitosamente'
            });

        } catch (error) {
            await connection.rollback();
            console.error('[CAMPAIGN-CREATE] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear campaña: ' + error.message
            });
        } finally {
            connection.release();
        }
    });

    // ==========================================
    // 4. LISTAR CAMPAÑAS PERSONALIZADAS
    // ==========================================
    app.get('/api/campaigns/personalized/list', async (req, res) => {
        try {
            const { sessionId } = req.query;

            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'sessionId es requerido'
                });
            }

            // Obtener campañas con estadísticas
            const [campaigns] = await pool.execute(
                `SELECT 
                    pc.*,
                    COUNT(crd.id) as total_recipients,
                    SUM(CASE WHEN crd.status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN crd.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN crd.status = 'read' THEN 1 ELSE 0 END) as read_count,
                    SUM(CASE WHEN crd.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN crd.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN crd.paid = TRUE THEN 1 ELSE 0 END) as paid_count
                FROM personalized_campaigns pc
                LEFT JOIN campaign_recipients_detailed crd ON pc.id = crd.campaign_id
                WHERE pc.session_id = ?
                GROUP BY pc.id
                ORDER BY pc.created_at DESC`,
                [sessionId]
            );

            // Para cada campaña, obtener sus destinatarios
            for (const campaign of campaigns) {
                const [recipients] = await pool.execute(
                    'SELECT * FROM campaign_recipients_detailed WHERE campaign_id = ? ORDER BY created_at',
                    [campaign.id]
                );
                campaign.recipients = recipients;
            }

            res.json({
                success: true,
                campaigns
            });

        } catch (error) {
            console.error('[CAMPAIGNS-LIST] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al listar campañas'
            });
        }
    });

    // ==========================================
    // 5. OBTENER CAMPAÑA ESPECÍFICA
    // ==========================================
    app.get('/api/campaigns/personalized/:id', async (req, res) => {
        try {
            const { id } = req.params;

            const [campaigns] = await pool.execute(
                'SELECT * FROM personalized_campaigns WHERE id = ?',
                [id]
            );

            if (campaigns.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            const campaign = campaigns[0];

            // Obtener destinatarios
            const [recipients] = await pool.execute(
                'SELECT * FROM campaign_recipients_detailed WHERE campaign_id = ? ORDER BY created_at',
                [id]
            );

            campaign.recipients = recipients;

            res.json({
                success: true,
                campaign
            });

        } catch (error) {
            console.error('[CAMPAIGN-GET] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener campaña'
            });
        }
    });

    // ==========================================
    // 6. ACTUALIZAR DESTINATARIO
    // ==========================================
    app.put('/api/campaigns/personalized/recipient/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, amount, dueDay, installments, paid } = req.body;

            const updates = [];
            const values = [];

            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (amount !== undefined) {
                updates.push('amount = ?');
                values.push(amount);
            }
            if (dueDay !== undefined) {
                updates.push('due_day = ?');
                values.push(dueDay);
            }
            if (installments !== undefined) {
                updates.push('installments = ?');
                values.push(installments);
            }
            if (paid !== undefined) {
                updates.push('paid = ?');
                values.push(paid ? 1 : 0);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se proporcionaron campos para actualizar'
                });
            }

            values.push(id);

            await pool.execute(
                `UPDATE campaign_recipients_detailed SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            // Obtener registro actualizado
            const [recipients] = await pool.execute(
                'SELECT * FROM campaign_recipients_detailed WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                recipient: recipients[0]
            });

        } catch (error) {
            console.error('[RECIPIENT-UPDATE] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar destinatario'
            });
        }
    });

    // ==========================================
    // 7. ELIMINAR DESTINATARIO
    // ==========================================
    app.delete('/api/campaigns/personalized/recipient/:id', async (req, res) => {
        try {
            const { id } = req.params;

            await pool.execute(
                'DELETE FROM campaign_recipients_detailed WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Destinatario eliminado'
            });

        } catch (error) {
            console.error('[RECIPIENT-DELETE] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar destinatario'
            });
        }
    });

    // ==========================================
    // 8. MARCAR DESTINATARIO COMO PAGADO
    // ==========================================
    app.post('/api/campaigns/personalized/recipient/:id/mark-paid', async (req, res) => {
        try {
            const { id } = req.params;

            await pool.execute(
                'UPDATE campaign_recipients_detailed SET paid = TRUE WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Destinatario marcado como pagado'
            });

        } catch (error) {
            console.error('[RECIPIENT-MARK-PAID] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al marcar como pagado'
            });
        }
    });

    // ==========================================
    // 9. ACTUALIZAR ESTADO DE CAMPAÑA
    // ==========================================
    app.put('/api/campaigns/personalized/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { status, name, messageTemplate } = req.body;

            const updates = [];
            const values = [];

            if (status !== undefined) {
                updates.push('status = ?');
                values.push(status);
            }
            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (messageTemplate !== undefined) {
                updates.push('message_template = ?');
                values.push(messageTemplate);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se proporcionaron campos para actualizar'
                });
            }

            values.push(id);

            await pool.execute(
                `UPDATE personalized_campaigns SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            res.json({
                success: true,
                message: 'Campaña actualizada'
            });

        } catch (error) {
            console.error('[CAMPAIGN-UPDATE] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar campaña'
            });
        }
    });

    // ==========================================
    // 10. ELIMINAR CAMPAÑA
    // ==========================================
    app.delete('/api/campaigns/personalized/:id', async (req, res) => {
        try {
            const { id } = req.params;

            // El CASCADE DELETE eliminará automáticamente los destinatarios
            await pool.execute(
                'DELETE FROM personalized_campaigns WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Campaña eliminada'
            });

        } catch (error) {
            console.error('[CAMPAIGN-DELETE] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar campaña'
            });
        }
    });

    console.log('✅ Endpoints de Campañas Personalizadas cargados');
};
