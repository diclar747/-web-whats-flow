// Test script to check if agent can authenticate
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'whatsflow_jwt_secret';

// Create a test token for agent ID 5
const testToken = jwt.sign(
    { id: 5, role: 'agent', email: 'test@agent.com' },
    JWT_SECRET,
    { expiresIn: '24h' }
);

console.log('\n🔐 Test JWT Token for Agent ID 5:');
console.log(testToken);
console.log('\n📋 Decoded:');
console.log(jwt.decode(testToken));

// Test the API call
const fetch = require('node-fetch');

async function testAPI() {
    try {
        const response = await fetch('http://localhost:3001/api/agents/5/chats?sessionId=1', {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        console.log('\n📡 API Response Status:', response.status);
        const data = await response.json();
        console.log('📦 API Response Data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testAPI();
