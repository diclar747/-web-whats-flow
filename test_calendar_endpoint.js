const fetch = require('node-fetch');

async function testCalendarEndpoint() {
    try {
        // Test 1: Get a valid token from the database
        const mysql = require('mysql2/promise');
        require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log('✅ Connected to database');

        // Get admin user to generate a token
        const [users] = await connection.execute(
            `SELECT * FROM users WHERE email = 'claudio@cnid.com.py' LIMIT 1`
        );

        if (users.length === 0) {
            console.log('❌ Admin user not found');
            await connection.end();
            return;
        }

        const user = users[0];
        console.log('Found user:', user.email);

        // Generate a JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                type: 'admin'
            },
            process.env.JWT_SECRET || 'whatsflow_jwt_secret',
            { expiresIn: '24h' }
        );

        console.log('Generated token:', token.substring(0, 50) + '...');

        // Test 2: Call the calendar search endpoint
        const sessionId = '1';
        const searchTerm = 'Ges';
        const url = `http://localhost:3001/api/contacts/search-by-name/${sessionId}/${encodeURIComponent(searchTerm)}`;

        console.log('\n📡 Testing endpoint:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', JSON.stringify(data, null, 2));

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

testCalendarEndpoint();
