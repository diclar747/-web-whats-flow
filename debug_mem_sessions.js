const { sessions } = require('./src/server/index.js');
console.log('Total sessions in memory:', sessions.size);
const keys = Array.from(sessions.keys());
console.log('First 20 keys:', keys.slice(0, 20));
for (const key of keys.slice(0, 10)) {
    const s = sessions.get(key);
    console.log(`Session ${key}: isConnected=${s.isConnected}, phoneNumber=${s.phoneNumber}`);
}
process.exit(0);
