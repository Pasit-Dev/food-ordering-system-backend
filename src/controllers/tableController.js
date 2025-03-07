import { t } from "elysia";
import pool from '../db/database.js';
import { v4 as uuidv4 } from "uuid";

export const tableController = {
    // การดึงข้อมูลตารางทั้งหมด
    getTables: async () => {
        try {
            const tablesResult = await pool.query('SELECT * FROM tables ORDER BY table_number');
    
            if (tablesResult.rows.length === 0) {
                return { status: 404, message: 'No tables found' };
            }
    
            // const tables = await Promise.all(
            //     tablesResult.rows.map(async (table) => {
            //         // กรณีนี้สามารถเพิ่มการดึงข้อมูลเพิ่มเติมเกี่ยวกับแต่ละโต๊ะ เช่น ประวัติการจอง หรือข้อมูลอื่นๆ
            //         const ordersResult = await pool.query(
            //             `SELECT * FROM Orders WHERE table_id = $1`,
            //             [table.table_id]
            //         );
    
            //         return {
            //             ...table,
            //             orders: ordersResult.rows,  // เพิ่มรายการคำสั่งซื้อที่เกี่ยวข้องกับโต๊ะนั้น
            //         };
            //     })
            // );
    
            return tablesResult.rows;
        } catch (err) {
            console.error('Error fetching tables:', err);
            return { status: 500, message: 'Internal server error while fetching tables' };
        }
    },
    

    // การดึงข้อมูลตารางตาม table_id
    getTableById: async ({ params }) => {
        const { table_id } = params;
        try {
            const tableResult = await pool.query('SELECT * FROM tables WHERE table_id = $1', [table_id]);

            if (tableResult.rows.length === 0) {
                return { status: 404, message: `Table with id ${table_id} not found` };
            }

            const table = tableResult.rows[0];

            // // ถ้าต้องการดึงข้อมูลที่เกี่ยวข้องกับโต๊ะ เช่น คำสั่งซื้อ
            // const ordersResult = await pool.query('SELECT * FROM Orders WHERE table_id = $1', [tableId]);

            // return {
            //     ...table,
            //     orders: ordersResult.rows,  // เพิ่มรายการคำสั่งซื้อที่เกี่ยวข้อง
            // };
            return table;
        } catch (err) {
            console.error('Error fetching table by id:', err);
            return { status: 500, message: 'Internal server error while fetching table by id' };
        }
    },


    getOrderFromTable: async ({ params }) => {
        const { table_id } = params;
        try {
            // ดึงคำสั่งซื้อแค่คำสั่งเดียวจากตาราง Orders ที่ตรงกับ table_id
            const orderResult = await pool.query(
                `SELECT * FROM Orders WHERE table_id = $1 AND order_status = 'Pending' LIMIT 1`,
                [table_id]
            );

            if (orderResult.rows.length === 0) {
                return { status: 404, message: `No orders found for table ${table_id}` };
            }

            return orderResult.rows[0]; // คืนคำสั่งซื้อแรกที่พบ
        } catch (err) {
            console.error('Error fetching order from table:', err);
            return { status: 500, message: 'Internal server error while fetching order from table' };
        }
    },


    // การสร้างตารางใหม่
    createTable: async ({ body, set }) => {
        const { table_number, table_status } = body;

        if (!table_number || !table_status) {
            return { status: 400, message: 'Missing required fields' };
        }

        const table_id = uuidv4(); // Generate UUID for table_id

        try {
            const result = await pool.query(
                `INSERT INTO tables (table_id, table_number, table_status)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [table_id, table_number, table_status]
            );

            set.status = 201;
            return result.rows[0];
        } catch (err) {
            console.error('Error creating table:', err);

            if (err.code === '23505') {
                return { status: 409, message: 'Table number already exists' };
            }
            return { status: 500, message: 'Internal server error while creating table' };
        }
    },

    // การลบตาราง
    deleteTable: async ({ params }) => {
        const { table_id } = params;
        try {
            const result = await pool.query("DELETE FROM tables WHERE table_id = $1 RETURNING *", [table_id]);
            if (result.rows.length === 0) {
                return { status: 404, message: 'Table not found' };
            }
            return { status: 200, message: 'Table deleted successfully' };
        } catch (err) {
            console.error('Error deleting table:', err);
            return { status: 500, message: 'Internal server error while deleting table' };
        }
    },

    // การอัพเดตตาราง
    updateTable: async ({ params, body, set }) => {
        const { table_id } = params;
        const { table_number, table_status } = body;

        if (!table_number || !table_status) {
            return { status: 400, message: 'Missing required fields' };
        }

        try {
            const result = await pool.query(
                `UPDATE tables
                 SET table_number = $1, table_status = $2
                 WHERE table_id = $3
                 RETURNING *`,
                [table_number, table_status, table_id]
            );

            if (result.rows.length === 0) {
                return { status: 404, message: 'Table not found' };
            }

            set.status = 200;
            return { status: 200, message: 'Table updated successfully', table: result.rows[0] };
        } catch (err) {
            console.error('Error updating table:', err);
            return { status: 500, message: 'Internal server error while updating table' };
        }
    },

    // Validation schema for creating a table
    validationCreateTable: t.Object({
        table_number: t.Number(),
        table_status: t.String(),
    }),

    // Validation schema for updating a table
    validationUpdateTable: t.Object({
        table_number: t.Number(),
        table_status: t.String(),
    })
};
