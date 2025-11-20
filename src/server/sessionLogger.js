/**
 * Sistema de Logging Detallado para Debugging de Sesiones
 * Captura todos los eventos relacionados con sesiones para análisis
 */

const fs = require('fs').promises;
const path = require('path');

class SessionLogger {
    constructor() {
        this.logDir = path.join(__dirname, '../../session-logs');
        this.logs = new Map(); // sessionId -> array de eventos
        this.initLogDirectory();
    }

    async initLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            console.log('✅ [SESSION-LOGGER] Directorio de logs creado:', this.logDir);
        } catch (error) {
            console.error('❌ [SESSION-LOGGER] Error creando directorio:', error);
        }
    }

    /**
     * Registrar un evento de sesión
     */
    log(sessionId, eventType, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            eventType,
            sessionId,
            data,
            stackTrace: this.getStackTrace()
        };

        // Guardar en memoria
        if (!this.logs.has(sessionId)) {
            this.logs.set(sessionId, []);
        }
        this.logs.get(sessionId).push(logEntry);

        // Log en consola con formato
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 [SESSION-LOG] ${eventType}`);
        console.log(`📱 Session: ${sessionId}`);
        console.log(`⏰ Time: ${timestamp}`);
        console.log(`📊 Data:`, JSON.stringify(data, null, 2));
        console.log(`${'='.repeat(80)}\n`);

        // Guardar en archivo de forma asíncrona (no bloqueante)
        this.saveToFile(sessionId, logEntry).catch(err => 
            console.error('❌ Error guardando log:', err)
        );
    }

    /**
     * Obtener stack trace para saber desde dónde se llamó
     */
    getStackTrace() {
        const stack = new Error().stack;
        const lines = stack.split('\n').slice(3, 6); // Saltar las primeras 3 líneas
        return lines.map(line => line.trim()).join(' | ');
    }

    /**
     * Guardar logs en archivo JSON
     */
    async saveToFile(sessionId, logEntry) {
        try {
            const filename = `session_${sessionId}_${Date.now()}.json`;
            const filepath = path.join(this.logDir, filename);
            
            // Leer logs existentes o crear nuevo array
            let allLogs = this.logs.get(sessionId) || [];
            
            await fs.writeFile(filepath, JSON.stringify(allLogs, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ Error escribiendo archivo de log:', error);
        }
    }

    /**
     * Obtener todos los logs de una sesión
     */
    getSessionLogs(sessionId) {
        return this.logs.get(sessionId) || [];
    }

    /**
     * Obtener resumen de logs
     */
    getSummary(sessionId) {
        const logs = this.logs.get(sessionId) || [];
        const eventCounts = {};
        
        logs.forEach(log => {
            eventCounts[log.eventType] = (eventCounts[log.eventType] || 0) + 1;
        });

        return {
            totalEvents: logs.length,
            firstEvent: logs[0]?.timestamp,
            lastEvent: logs[logs.length - 1]?.timestamp,
            eventCounts,
            logs: logs.map(log => ({
                time: log.timestamp,
                event: log.eventType,
                summary: this.summarizeData(log.data)
            }))
        };
    }

    /**
     * Resumir datos para visualización
     */
    summarizeData(data) {
        if (typeof data === 'string') return data;
        if (typeof data === 'object') {
            const keys = Object.keys(data);
            if (keys.length === 0) return '{}';
            if (keys.length <= 3) return JSON.stringify(data);
            return `{${keys.slice(0, 3).join(', ')}... (${keys.length} keys)}`;
        }
        return String(data);
    }

    /**
     * Limpiar logs antiguos (mantener solo últimas 24 horas)
     */
    async cleanOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 horas

            for (const file of files) {
                const filepath = path.join(this.logDir, file);
                const stats = await fs.stat(filepath);
                const age = now - stats.mtimeMs;

                if (age > maxAge) {
                    await fs.unlink(filepath);
                    console.log(`🗑️ Log antiguo eliminado: ${file}`);
                }
            }
        } catch (error) {
            console.error('❌ Error limpiando logs antiguos:', error);
        }
    }

    /**
     * Exportar logs como HTML para visualización
     */
    generateHTML(sessionId) {
        const logs = this.logs.get(sessionId) || [];
        const summary = this.getSummary(sessionId);

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Logs - ${sessionId}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 { 
            color: #333; 
            margin-bottom: 10px;
            font-size: 2em;
        }
        .session-id {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 20px;
            font-family: monospace;
        }
        .summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .summary-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .summary-label {
            font-size: 0.85em;
            color: #666;
            margin-bottom: 5px;
        }
        .summary-value {
            font-size: 1.2em;
            font-weight: bold;
            color: #333;
        }
        .timeline {
            position: relative;
            padding-left: 40px;
        }
        .timeline::before {
            content: '';
            position: absolute;
            left: 20px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(to bottom, #667eea, #764ba2);
        }
        .log-entry {
            position: relative;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
            transition: all 0.3s;
        }
        .log-entry:hover {
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transform: translateX(5px);
        }
        .log-entry::before {
            content: '';
            position: absolute;
            left: -32px;
            top: 25px;
            width: 12px;
            height: 12px;
            background: #667eea;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 0 2px #667eea;
        }
        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .event-type {
            font-weight: bold;
            color: #667eea;
            font-size: 1.1em;
        }
        .timestamp {
            color: #666;
            font-size: 0.85em;
            font-family: monospace;
        }
        .log-data {
            background: #fff;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 0.9em;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
        }
        .stack-trace {
            margin-top: 10px;
            padding: 10px;
            background: #fff3cd;
            border-radius: 5px;
            font-size: 0.8em;
            font-family: monospace;
            color: #856404;
        }
        .event-LOGIN { border-left-color: #28a745; }
        .event-LOGIN::before { background: #28a745; box-shadow: 0 0 0 2px #28a745; }
        .event-LOGOUT { border-left-color: #dc3545; }
        .event-LOGOUT::before { background: #dc3545; box-shadow: 0 0 0 2px #dc3545; }
        .event-SOCKET { border-left-color: #ffc107; }
        .event-SOCKET::before { background: #ffc107; box-shadow: 0 0 0 2px #ffc107; }
        .event-ERROR { border-left-color: #e74c3c; }
        .event-ERROR::before { background: #e74c3c; box-shadow: 0 0 0 2px #e74c3c; }
        .filter-buttons {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .filter-btn {
            padding: 10px 20px;
            border: 2px solid #667eea;
            background: white;
            color: #667eea;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 600;
        }
        .filter-btn:hover, .filter-btn.active {
            background: #667eea;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Session Debug Logs</h1>
        <div class="session-id">Session ID: ${sessionId}</div>
        
        <div class="summary">
            <div class="summary-item">
                <div class="summary-label">Total Events</div>
                <div class="summary-value">${summary.totalEvents}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">First Event</div>
                <div class="summary-value">${summary.firstEvent ? new Date(summary.firstEvent).toLocaleTimeString() : 'N/A'}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Last Event</div>
                <div class="summary-value">${summary.lastEvent ? new Date(summary.lastEvent).toLocaleTimeString() : 'N/A'}</div>
            </div>
            ${Object.entries(summary.eventCounts).map(([event, count]) => `
                <div class="summary-item">
                    <div class="summary-label">${event}</div>
                    <div class="summary-value">${count}</div>
                </div>
            `).join('')}
        </div>

        <div class="filter-buttons">
            <button class="filter-btn active" onclick="filterLogs('ALL')">Todos</button>
            <button class="filter-btn" onclick="filterLogs('LOGIN')">Login</button>
            <button class="filter-btn" onclick="filterLogs('LOGOUT')">Logout</button>
            <button class="filter-btn" onclick="filterLogs('SOCKET')">Socket</button>
            <button class="filter-btn" onclick="filterLogs('ERROR')">Errors</button>
        </div>

        <div class="timeline">
            ${logs.map(log => `
                <div class="log-entry event-${log.eventType.split('_')[0]}" data-event="${log.eventType}">
                    <div class="log-header">
                        <span class="event-type">${log.eventType}</span>
                        <span class="timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="log-data">${JSON.stringify(log.data, null, 2)}</div>
                    ${log.stackTrace ? `<div class="stack-trace">${log.stackTrace}</div>` : ''}
                </div>
            `).join('')}
        </div>
    </div>

    <script>
        function filterLogs(type) {
            const entries = document.querySelectorAll('.log-entry');
            const buttons = document.querySelectorAll('.filter-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            entries.forEach(entry => {
                if (type === 'ALL' || entry.dataset.event.startsWith(type)) {
                    entry.style.display = 'block';
                } else {
                    entry.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>
        `;
    }
}

// Exportar instancia única
const sessionLogger = new SessionLogger();

// Limpiar logs antiguos cada 6 horas
setInterval(() => {
    sessionLogger.cleanOldLogs();
}, 6 * 60 * 60 * 1000);

module.exports = sessionLogger;
