const { sessions } = require('./src/server/index.js');
console.log('Sessions in memory:', Array.from(sessions.keys()));
for (const [id, session] of sessions.entries()) {
    console.log(`Session ${id}: isConnected=${session.isConnected}, phone=${session.phoneNumber}`);
}
process.exit(0);
