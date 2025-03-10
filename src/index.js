import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import tableRoutes from "./routes/tableRoutes"; // Ensure the path is correct
import { swagger } from '@elysiajs/swagger';
import menuRoutes from "./routes/menuRoutes";
import orderRoutes from "./routes/orderRoutes";
import orderItemRoutes from "./routes/orderItemRoutes";
import pool from "./db/database";
import { initDatabase } from "./initDatabase";
import { resetDatabase } from "./resetDatabase";
const PORT = process.env.PORT || 3005;

pool.connect().then(() => console.log('Connected to PostgreSQL'))
.catch((err) => {
  console.error('Error connecting to PostgreSQL', err)
  process.exit(1);
})

initDatabase()

const app = new Elysia()
  .use(cors({
    origin: ['*'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }))
  .use(swagger({
    path: "/v1/swagger"
  }))
  .get('/', () => 'Welcome to Bun Elysia')
.group('/tables', tableRoutes)
.group('/menus', menuRoutes)
.group('/orders', orderRoutes)
.group('/order-items', orderItemRoutes)
.post('/reset-database', async (req, res) => {
  await resetDatabase();
  await initDatabase();
})
.listen(PORT);
  


  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);