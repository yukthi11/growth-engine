const { Pool } = require('pg');
const path = require('path');

// Always load from the project root .env
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'testing',
});

pool.on('connect', () => {
    // console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

module.exports = pool;