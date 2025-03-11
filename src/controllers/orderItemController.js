import pool from "../db/database";

export const orderItemController = {
    getOrderItemsByOrderId: async ({ params }) => {
        const { order_id } = params;
    
        if (!order_id) {
            return { status: 400, message: 'Order ID is required' };
        }
    
        const client = await pool.connect();
        try {
            console.log(`Fetching order items for order_id: ${order_id}`);
    
            const query = `
                SELECT
                    oi.order_item_id,
                    oi.order_id,
                    oi.menu_id,
                    oi.quantity,
                    oi.price,
                    oi.order_item_status,
                    oi.note AS order_item_note,
                    m.menu_name,
                    m.price AS menu_price,
                    m.image AS menu_image,
                    COALESCE(
                        JSON_AGG(
                            JSONB_BUILD_OBJECT(
                                'option_name', mo.option_name,
                                'additional_price', mo.additional_price
                            )
                        ) FILTER (WHERE mo.menu_option_id IS NOT NULL), 
                        '[]'::JSON
                    ) AS options
                FROM
                    OrderItems oi
                LEFT JOIN Menus m ON oi.menu_id = m.menu_id
                LEFT JOIN OrderItemOptions oio ON oi.order_item_id = oio.order_item_id
                LEFT JOIN MenuOptions mo ON oio.menu_option_id = mo.menu_option_id
                WHERE
                    oi.order_id = $1
                GROUP BY
                    oi.order_item_id, oi.order_id, oi.menu_id, oi.quantity, oi.price, oi.order_item_status, oi.note, m.menu_name, m.price, m.image;
            `;
            
            const { rows } = await client.query(query, [order_id]);
    
            if (rows.length === 0) {
                return { status: 404, message: 'Order items not found', order_items: [] };
            }
    
            console.log(`Fetched ${rows.length} order items`);
    
            return { order_items: rows };
        } catch (err) {
            console.error('Error fetching order items:', err);
            return { status: 500, message: 'Internal server error while fetching order items', error: err.message };
        } finally {
            client.release();
        }
    },

    updateStatus: async ({ params, body, set }) => {
        const { order_item_id } = params;
        const { new_status, user, change_reason } = body;

        if (!order_item_id || !new_status) {
            set.status = 400;
            return { message: 'Order item ID and new Status are required' };
        }

        const client = await pool.connect();

        try {
            const currentItemRes = await client.query(
                'SELECT order_item_status FROM OrderItems WHERE order_item_id = $1',
                [order_item_id]
            );

            if (currentItemRes.rowCount === 0) {
                set.status = 404;
                return { message: "Order item not found" };
            }

            const currentItem = currentItemRes.rows[0];
            const currentStatus = currentItem.order_item_status;

            if (user === 'customer' && currentStatus !== 'Pending') {
                set.status = 403;
                return { message: 'Customers can only cancel pending orders' };
            }

            const finalStatus = user === 'customer' ? 'Cancelled' : new_status;

            await client.query(
                `INSERT INTO OrderItemHistory (order_item_id, previous_status, status, changed_by, change_reason)
                 VALUES ($1, $2, $3, $4, $5)`,
                [order_item_id, currentStatus, finalStatus, user, change_reason || '']
            );

            await client.query(
                'UPDATE OrderItems SET order_item_status = $1 WHERE order_item_id = $2',
                [finalStatus, order_item_id]
            );

            set.status = 200;
            return {
                message: 'Order item status updated successfully',
                new_status: finalStatus
            };
        } catch (err) {
            console.error('Error updating order item status:', err);
            set.status = 500;
            return {
                message: 'Internal server error while updating order item status',
                error: err.message
            };
        } finally {
            client.release();
        }
    },
    getBestSellingMenu: async () => {
        const client = await pool.connect();

        try {
            console.log('Fetching best selling menus...');
    
            // Query เพื่อหาว่าเมนูไหนที่ขายดีที่สุด (มีจำนวนการสั่งซื้อสูงสุด)
            const query = `
                SELECT 
                    m.menu_id,
                    m.menu_name,
                    SUM(oi.quantity) AS total_sold
                FROM 
                    OrderItems oi
                INNER JOIN Menus m ON oi.menu_id = m.menu_id
                WHERE
                    oi.order_item_status = 'Served'  -- หรือสถานะที่หมายถึงการขายสำเร็จ
                GROUP BY
                    m.menu_id
                ORDER BY
                    total_sold DESC
                LIMIT 1;  -- เอาแค่อันดับแรก
            `;
    
            const { rows } = await client.query(query);
    
            if (rows.length === 0) {
                return { status: 404, message: 'No best selling menus found', best_selling_menus: [] };
            }
    
            console.log(`Fetched ${rows.length} best selling menus`);
    
            return { best_selling_menus: rows };
        } catch (err) {
            console.error('Error fetching best selling menus:', err);
            return { status: 500, message: 'Internal server error while fetching best selling menus', error: err.message };
        } finally {
            client.release();
        }
    },

    getTopFiveMenu: async () => {
        const client = await pool.connect();

        try {
            console.log('Fetching top five menus...');
    
            // Query เพื่อหาว่าเมนูไหนที่ขายดีที่สุด (มีจำนวนการสั่งซื้อสูงสุด)
            const query = `
                SELECT 
                    m.menu_id,
                    m.menu_name,
                    m.price AS menu_price,
                    m.image AS menu_image,
                    SUM(oi.quantity) AS total_sold
                FROM 
                    OrderItems oi
                INNER JOIN Menus m ON oi.menu_id = m.menu_id
                WHERE
                    oi.order_item_status = 'Served'  -- หรือสถานะที่หมายถึงการขายสำเร็จ
                GROUP BY
                    m.menu_id
                ORDER BY
                    total_sold DESC
                LIMIT 5;  -- เอาแค่ 5 อันดับแรก
            `;
    
            const { rows } = await client.query(query);
    
            if (rows.length === 0) {
                return { status: 404, message: 'No top five menus found', best_selling_menus: [] };
            }
    
            console.log(`Fetched ${rows.length} top five menus`);
    
            return { best_selling_menus: rows };
        } catch (err) {
            console.error('Error fetching top five menus:', err);
            return { status: 500, message: 'Internal server error while fetching best selling menus', error: err.message };
        } finally {
            client.release();
        }
    }
};
