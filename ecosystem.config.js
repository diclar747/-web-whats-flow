module.exports = {
    apps: [{
        name: 'whatsflow-server',
        script: './src/server/index.js',

        // 🚀 IMPORTANTE: Mantenemos fork mode por ahora (sesiones de Baileys)
        // Cambiar a cluster cuando migremos sesiones a Redis
        instances: 1,
        exec_mode: 'fork',

        // 💾 GESTIÓN DE MEMORIA OPTIMIZADA
        // Con 34+ sesiones de Baileys, necesitamos mínimo 2GB
        // Cada sesión consume ~25-40MB de memoria
        max_memory_restart: '3G', // Reinicia solo si supera 3GB (antes 500MB)

        // ⚡ AUTO-RESTART con límites más conservadores
        autorestart: true,
        watch: false, // No usar en producción
        max_restarts: 5, // Reducido de 10 a 5 para detectar problemas
        min_uptime: '30s', // Aumentado de 10s a 30s para estabilidad
        restart_delay: 5000, // Esperar 5 segundos entre reinicios

        // 📝 LOGS
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // 🔧 VARIABLES DE ENTORNO
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000,
            // Configuración de Garbage Collector optimizada
            UV_THREADPOOL_SIZE: 16 // Aumentar pool de threads para I/O
        },

        // 🔄 ZERO DOWNTIME RELOAD - tiempos más largos para sesiones WA
        listen_timeout: 30000, // Aumentado de 10s a 30s
        kill_timeout: 15000, // Aumentado de 5s a 15s para cerrar sesiones

        // 📊 MONITOREO
        instance_var: 'INSTANCE_ID',

        // 🔍 NODE ARGS OPTIMIZADO PARA MULTISESIÓN
        // 2GB heap + optimizaciones de GC
        node_args: [
            '--max-old-space-size=2048', // 2GB de heap (antes 512MB)
            '--max-semi-space-size=128', // Mejorar GC para objetos pequeños
            '--optimize-for-size', // Optimizar uso de memoria
            '--gc-interval=100' // GC más frecuente para evitar picos
        ].join(' ')
    }]
};
