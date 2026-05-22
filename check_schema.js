const { Client } = require('pg'); 
const client = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'root@123', database: 'testing' }); 
async function run() { 
    await client.connect(); 
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads'"); 
    console.log(res.rows); 
    await client.end(); 
} 
run().catch(console.error);
