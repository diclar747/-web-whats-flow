const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow'
};

async function fixStatusesTable() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🔍 Verificando estructura de tabla whatsapp_statuses...');
    
    // Verificar si la columna phone existe
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'whatsapp_statuses'`,
      [dbConfig.database]
    );
    
    const hasPhoneColumn = columns.some(col => col.COLUMN_NAME === 'phone');
    
    if (!hasPhoneColumn) {
      console.log('⚠️ Columna phone no encontrada. Agregándola...');
      await connection.execute(
        `ALTER TABLE whatsapp_statuses ADD COLUMN phone VARCHAR(50) AFTER session_id`
      );
      console.log('✅ Columna phone agregada');
      
      // Actualizar registros existentes
      await connection.execute(
        `UPDATE whatsapp_statuses SET phone = 'unknown' WHERE phone IS NULL OR phone = ''`
      );
      console.log('✅ Registros actualizados');
    } else {
      console.log('✅ Columna phone ya existe');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixStatusesTable();
