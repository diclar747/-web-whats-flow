const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'whatsflow'
};

async function createManagementTables() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database.');

    try {
        // Table for Categories
        console.log('Creating fin_categories table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS fin_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                type ENUM('income', 'expense') NOT NULL,
                description TEXT,
                status ENUM('active', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_type (user_id, type),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Table for Budgets
        console.log('Creating fin_budgets table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS fin_budgets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                total_amount DECIMAL(15, 2) NOT NULL,
                description TEXT,
                status ENUM('active', 'closed') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_dates (user_id, start_date, end_date),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Table for Financial Records
        console.log('Creating fin_records table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS fin_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                category_id INT NOT NULL,
                budget_id INT DEFAULT NULL,
                type ENUM('income', 'expense') NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                description TEXT,
                record_date DATE NOT NULL,
                payment_method VARCHAR(100),
                reference_number VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_type_date (user_id, type, record_date),
                INDEX idx_budget (budget_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES fin_categories(id) ON DELETE RESTRICT,
                FOREIGN KEY (budget_id) REFERENCES fin_budgets(id) ON DELETE SET NULL
            )
        `);

        console.log('All management tables created successfully.');
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        await connection.end();
    }
}

createManagementTables();
