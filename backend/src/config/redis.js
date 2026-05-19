const Redis = require('ioredis');
require('dotenv').config();

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    lazyConnect: true, // PHASE 6 - Don't crash at boot
};

const connection = new Redis(redisConfig);

let lastWarningTime = 0;
const WARNING_COOLDOWN = 30000; // 30 seconds

connection.on('error', (err) => {
    const now = Date.now();
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        if (now - lastWarningTime > WARNING_COOLDOWN) {
            console.warn(`[Redis] Connection refused at ${redisConfig.host}:${redisConfig.port}. (Discovery/Workers paused until Docker is started)`);
            lastWarningTime = now;
        }
        return; // Suppress the massive AggregateError stack trace
    }
    console.error('Redis Connection Error:', err);
});

module.exports = {
    connection,
    redisConfig
};
