import pool from "../db/database";

export const orderItemController = {
    getOrderItemsByOrderId: async ({ params }) => {
        const { order_id } = params;  // Get order_id from params
    
        if (!order_id) {
            return { status: 400, message: 'Order ID is required' }; // ตรวจสอบว่าได้ order_id มาหรือไม่
        }
    
        const client = await pool.connect();
        try {
            console.log(`Fetching order items for order_id: ${order_id}`); // Debug: log order_id
    
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
                    STRING_AGG(mo.option_name, ', ') AS menu_option_names,
                    SUM(CASE WHEN mo.menu_option_id IS NOT NULL THEN mo.additional_price ELSE 0 END) AS total_additional_price
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
                return { status: 404, message: 'Order items not found' };
            }
    
            console.log(`Fetched ${rows.length} order items`); // Debug: log the number of items fetched
    
            return { order_items: rows };
        } catch (err) {
            console.error('Error fetching order items:', err); // Log the detailed error
            return { status: 500, message: 'Internal server error while fetching order items', error: err.message };
        } finally {
            client.release();
        }
    },
    
    updateStatus: async ({ params, body, set }) => {
        const { order_item_id } = params;
        const { new_status, user, change_reason } = body;

        if (!order_item_id || !new_status) {
            // กำหนด HTTP status เป็น 400
            set.status = 400;
            return { message: 'Order item ID and new Status are required' };
        }

        const client = await pool.connect();

        try {
            // ดึงสถานะปัจจุบันจาก OrderItems
            const currentItemRes = await client.query('SELECT order_item_status FROM OrderItems WHERE order_item_id = $1', [order_item_id]);

            if (currentItemRes.rowCount === 0) {
                // กำหนด HTTP status เป็น 404
                set.status = 404;
                return { message: "Order item not found" };
            }

            const currentItem = currentItemRes.rows[0];
            const currentStatus = currentItem.order_item_status;

            if (user === 'customer' && currentStatus !== 'Pending') {
                // กำหนด HTTP status เป็น 403
                set.status = 403;
                return { message: 'Customers can only cancel pending orders' };
            }

            const finalStatus = user === 'customer' ? 'Cancelled' : new_status;

            // บันทึกประวัติการเปลี่ยนแปลงใน OrderItemHistory
            await client.query(
                `INSERT INTO OrderItemHistory (order_item_id, previous_status, status, changed_by, change_reason)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    order_item_id,
                    currentStatus, // สถานะก่อนการเปลี่ยนแปลง
                    finalStatus,   // สถานะหลังการเปลี่ยนแปลง
                    user,          // ผู้ทำการเปลี่ยนแปลง
                    change_reason || ''  // เหตุผลในการเปลี่ยนแปลง (ถ้ามี)
                ]
            );

            // อัปเดตสถานะใน OrderItems
            await client.query('UPDATE OrderItems SET order_item_status = $1 WHERE order_item_id = $2', [finalStatus, order_item_id]);

            // กำหนด HTTP status เป็น 200
            set.status = 200;
            return {
                message: 'Order item status updated successfully',
                new_status: finalStatus
            };
        } catch (err) {
            console.error('Error updating order item status:', err);
            // กำหนด HTTP status เป็น 500
            set.status = 500;
            return {
                message: 'Internal server error while updating order item status',
                error: err.message
            };
        } finally {
            client.release();
        }
    }
};
