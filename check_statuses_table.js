const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow'
};

async function checkTable() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🔍 Estructura de tabla whatsapp_statuses:');
    const [columns] = await connection.execute(
      `DESCRIBE whatsapp_statuses`
    );
    
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTable();
