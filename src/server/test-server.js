// Versión de prueba del servidor con configuración específica para desarrollo
console.log('✅ Iniciando servidor de pruebas para desarrollo');

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// Configuración específica para desarrollo - permite todas las conexiones locales
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000', 
    // Permitir conexiones durante desarrollo
    ...(process.env.NODE_ENV === 'production' ? [] : ['*'])
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin']
}));

app.use(express.json());
app.use(express.static('public'));

// Crear servidor HTTP
const server = createServer(app);

// Configurar Socket.IO con CORS más permisivo
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000', 
      // Permitir conexiones durante desarrollo
      ...(process.env.NODE_ENV === 'production' ? [] : ['*'])
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'] // Asegurarse de permitir ambos transportes
});

// Variables globales
const sessions = new Map();
let lastQRSession = null;

// Endpoint para crear sesión de WhatsApp
app.post('/api/create-session', async (req, res) => {
  try {
    console.log('Solicitud para crear sesión recibida');
    const sessionId = crypto.randomBytes(8).toString('hex');
    
    // Aquí iría la lógica para crear una nueva sesión de WhatsApp
    // Por ahora, solo devolvemos éxito
    
    sessions.set(sessionId, {
      id: sessionId,
      connected: false,
      qr: null
    });
    
    lastQRSession = sessionId;
    
    res.json({
      success: true,
      sessionId: sessionId,
      message: 'Sesión creada exitosamente',
      isConnected: false
    });
  } catch (error) {
    console.error('Error creando sesión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear sesión'
    });
  }
});

// Endpoint para obtener estado del QR
app.get('/api/qr-status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Buscar la sesión
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesión no encontrada'
      });
    }
    
    // Simular generación de QR o verificación de conexión
    let status = 'esperando';
    let qr = null;
    
    // Lógica simulada para obtener QR o estado
    if (!session.connected) {
      // Generar QR simulado
      qr = 'mock-qr-data-would-be-here';
      status = 'esperando_qr';
    } else {
      status = 'conectado';
    }
    
    res.json({
      success: true,
      status: status,
      qr: qr,
      sessionId: sessionId,
      isConnected: session.connected
    });
  } catch (error) {
    console.error('Error obteniendo estado del QR:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado del QR'
    });
  }
});

const PORT = process.env.PORT || 3000;

// Iniciar servidor en todas las interfaces
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n✅ WhatsApp Web API (Modo Desarrollo) iniciado en puerto ${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT} o http://127.0.0.1:${PORT}`);
  console.log(`🔗 Socket.IO escuchando conexiones`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   POST /api/create-session - Crear nueva sesión`);
  console.log(`   GET  /api/qr-status/:sessionId - Obtener estado del QR`);
});

// Manejo de errores del servidor
server.on('error', (error) => {
  console.error('Error del servidor:', error);
});

module.exports = { app, server, io };