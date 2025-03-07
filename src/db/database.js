import { Pool } from "pg";


const pool = new Pool({
    user: 'foodorderingsystem',
    host: 'localhost',
    database: 'foodorderingsystemdb',
    password: 'foodorderingsystem',
    port: '5432',
})


export default pool;