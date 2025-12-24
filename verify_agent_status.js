const http = require('http');
const jwt = require('jsonwebtoken');

const agentId = process.argv[2] || 3;
const status = process.argv[3] || 'busy';
const JWT_SECRET = process.env.JWT_SECRET || '0927450953d52b804a8e511e5a7f2f35bbd20f6c4c156902b4e0902214795eb4c6dafffc36e40489d6eda1ae3963ac42c2d043ab3a4a6382bc62c70fe8ed3a7b';

const apiUrl = 'http://localhost:3002';

console.log(`[VERIFY] Testing Agent Status Update (Secured)`);
console.log(`[VERIFY] Agent ID: ${agentId}`);
console.log(`[VERIFY] Target Status: ${status}`);

// 1. Try WITHOUT Token
function testUnauthorized() {
    console.log(`\n[TEST 1] Testing WITHOUT Token...`);
    const data = JSON.stringify({ status: status });

    const options = {
        hostname: 'localhost',
        port: 3002,
        path: `/api/agents/${agentId}/status`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = http.request(options, (res) => {
        console.log(`[TEST 1] Status Code: ${res.statusCode}`);
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.log(`[TEST 1] ✅ PASSED: Request rejected as expected.`);
            testAuthorized();
        } else {
            console.log(`[TEST 1] ❌ FAILED: Request should have been rejected.`);
            testAuthorized();
        }
    });

    req.on('error', (e) => console.error(`[TEST 1] Error: ${e.message}`));
    req.write(data);
    req.end();
}

// 2. Try WITH Token
function testAuthorized() {
    console.log(`\n[TEST 2] Testing WITH Token...`);

    // Generate valid token
    const token = jwt.sign({
        id: parseInt(agentId),
        email: 'testagent@whats-flow.com',
        role: 'agent'
    }, JWT_SECRET, { expiresIn: '1h' });

    console.log(`[TEST 2] Generated Token: ${token.substring(0, 20)}...`);

    const data = JSON.stringify({ status: status });

    const options = {
        hostname: 'localhost',
        port: 3002,
        path: `/api/agents/${agentId}/status`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'Authorization': `Bearer ${token}`
        }
    };

    const req = http.request(options, (res) => {
        console.log(`[TEST 2] Status Code: ${res.statusCode}`);

        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log(`[TEST 2] Response Body: ${body}`);
            if (res.statusCode === 200) {
                console.log(`[TEST 2] ✅ PASSED: Request succeeded.`);
            } else {
                console.log(`[TEST 2] ❌ FAILED: Request failed.`);
            }
        });
    });

    req.on('error', (e) => console.error(`[TEST 2] Error: ${e.message}`));
    req.write(data);
    req.end();
}

// Start tests
testUnauthorized();
