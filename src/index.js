import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import tableRoutes from "./routes/tableRoutes"; // Ensure the path is correct
import { swagger } from '@elysiajs/swagger';
import menuRoutes from "./routes/menuRoutes";
import orderRoutes from "./routes/orderRoutes";
import orderItemRoutes from "./routes/orderItemRoutes";
const PORT = process.env.PORT || 8080;

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
.listen(PORT);
  


  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);