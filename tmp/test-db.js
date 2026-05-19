const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('Testing DB connection with:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME
});

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'testing',
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('DB Connection Failed:', err.message);
    } else {
        console.log('DB Connection Successful:', res.rows[0].now);
    }
    pool.end();
    process.exit(err ? 1 : 0);
});
