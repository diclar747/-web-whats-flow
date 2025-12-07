const fs = require('fs');
try {
    const logs = fs.readFileSync('/root/.pm2/logs/whatsflow-server-error.log', 'utf8');
    const lines = logs.split('\n').slice(-50); // Últimas 50 líneas
    console.log(lines.join('\n'));
} catch (e) {
    console.log("Error leyendo logs:", e.message);
}
