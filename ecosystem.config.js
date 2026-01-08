module.exports = {
    apps: [{
        name: 'whatsflow-server',
        script: './src/server/index.js',

        // 🚀 IMPORTANTE: Mantenemos fork mode por ahora (sesiones de Baileys)
        // Cambiar a cluster cuando migremos sesiones a Redis
        instances: 1,
        exec_mode: 'fork',

        // 💾 GESTIÓN DE MEMORIA
        max_memory_restart: '500M', // Reinicia si supera 500MB

        // ⚡ AUTO-RESTART con límites
        autorestart: true,
        watch: false, // No usar en producción
        max_restarts: 10, // Máximo 10 reinicios en 1 minuto
        min_uptime: '10s', // Tiempo mínimo antes de considerar "exitoso"

        // 📝 LOGS
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // 🔧 VARIABLES DE ENTORNO
        env_production: {
            NODE_ENV: 'production',
            PORT: 3003
        },

        // 🔄 ZERO DOWNTIME RELOAD
        listen_timeout: 10000,
        kill_timeout: 5000,

        // 📊 MONITOREO
        instance_var: 'INSTANCE_ID',

        // 🔍 NODE ARGS para debugging (opcional)
        node_args: '--max-old-space-size=512'
    }]
};
