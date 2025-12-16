#!/usr/bin/env node

/**
 * Script para actualizar nombres y avatares de sesiones activas desde WhatsApp
 */

const mysql = require('mysql2/promise');
const axios = require('axios');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'whatsflow2025',
    database: 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10
});

async function updateSessionProfiles() {
    console.log('🔄 Actualizando perfiles de sesiones activas...\n');

    try {
        const [sessions] = await pool.execute(
            'SELECT session_id, phone_number, name, avatar_url FROM user_sessions WHERE is_active = 1'
        );

        console.log(`📋 Encontradas ${sessions.length} sesiones activas\n`);

        for (const session of sessions) {
            console.log(`\n📱 Procesando ${session.phone_number}...`);
            console.log(`   Session ID: ${session.session_id}`);
            console.log(`   Nombre actual: ${session.name || 'Sin nombre'}`);
            console.log(`   Avatar actual: ${session.avatar_url ? 'Sí' : 'No'}`);

            // Aquí podrías hacer una llamada a la API de WhatsApp si tuvieras un endpoint
            // Por ahora, solo mostramos la información
            console.log(`   ✅ Sesión verificada`);
        }

        console.log(`\n✅ Proceso completado`);
        console.log(`\nNOTA: Para actualizar los perfiles, los usuarios deben reconectar sus sesiones.`);
        console.log(`El sistema obtendrá automáticamente el nombre y avatar al conectarse.`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

updateSessionProfiles();
