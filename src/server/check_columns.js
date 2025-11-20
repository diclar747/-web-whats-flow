const mysql = require('mysql2/promise');

async function checkColumns() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10
  });

  try {
    const connection = await pool.getConnection();
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'whatsflow'
      AND TABLE_NAME = 'contacts'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Columnas actuales en contacts:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    
    connection.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkColumns();
