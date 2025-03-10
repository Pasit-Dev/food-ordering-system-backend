import { t } from 'elysia';
import pool from '../db/database'; 

export const orderController = {
    createOrder: async ({ body, set }) => {
        const { order_id, customer_name, table_id, items } = body;
    
        if (!order_id || !items) {
            return { status: 400, message: 'Missing required fields' };
        }
    
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
    
            let finalTableId = table_id === 'takeaway' ? null : table_id;
            let order_type = table_id === 'takeaway' ? 'Takeaway' : 'Dine-in';
    
            const checkOrderResult = await client.query(
                `SELECT order_id FROM Orders WHERE order_id = $1`,
                [order_id]
            );
    
            let insertedOrderId;
            if (checkOrderResult.rowCount === 0) {
                const insertOrderResult = await client.query(
                    `INSERT INTO Orders (order_id, table_id, order_status, order_type)
                     VALUES ($1, $2, $3, $4)
                     RETURNING order_id`,
                    [order_id, finalTableId, 'Not Paid', order_type]
                );
    
                if (insertOrderResult.rowCount !== 1) {
                    await client.query('ROLLBACK');
                    return { status: 500, message: 'Failed to insert order' };
                }
    
                insertedOrderId = insertOrderResult.rows[0].order_id;
    
                if (customer_name) {
                    await client.query(
                        `UPDATE Orders SET customer_name = $1 WHERE order_id = $2`,
                        [customer_name, insertedOrderId]
                    );
                }
    
                if (finalTableId) {
                    await client.query(
                        `UPDATE Tables SET table_status = 'Occupied' WHERE table_id = $1`,
                        [finalTableId]
                    );
                }
            } else {
                insertedOrderId = checkOrderResult.rows[0].order_id;
            }
    
            for (const item of items) {
                const { menu_id, quantity, price, options, note } = item;
    
                const insertOrderItemResult = await client.query(
                    `INSERT INTO OrderItems (order_id, menu_id, quantity, price, note)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING order_item_id`,
                    [insertedOrderId, menu_id, quantity, price, note]
                );
    
                const orderItemId = insertOrderItemResult.rows[0].order_item_id;
    
                if (options && options.length > 0) {
                    for (const option of options) {
                        const { menu_option_id, additional_price } = option;
                        await client.query(
                            `INSERT INTO OrderItemOptions (order_item_id, menu_option_id, additional_price)
                             VALUES ($1, $2, $3)`,
                            [orderItemId, menu_option_id, additional_price]
                        );
                    }
                }
    
            }
    
    
            await client.query('COMMIT');
            set.status = 201;
            return { message: 'Order items added successfully', order_id: insertedOrderId };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error creating order:', err);
            return { status: 500, message: 'Internal server error while creating order' };
        } finally {
            client.release();
        }
    },    
    
    getOrders: async () => {
        const client = await pool.connect();
        try {
            const query = `
                SELECT 
                    o.order_id, 
                    o.customer_name, 
                    o.payment_method,
                    o.table_id, 
                    t.table_number,  
                    o.order_date,  
                    o.order_status, 
                    o.order_type,
                    -- Calculate total_amount by summing the price of valid items
                    COALESCE(SUM(oi.price), 0) AS total_amount
                FROM Orders o
                LEFT JOIN Tables t ON o.table_id = t.table_id
                LEFT JOIN OrderItems oi ON o.order_id = oi.order_id AND oi.order_item_status != 'Cancelled'
                GROUP BY o.order_id, o.customer_name, o.table_id, t.table_number, o.order_date, o.order_status, o.order_type
            `;
            
            const { rows } = await client.query(query);
    
            if (rows.length === 0) {
                return { status: 404, message: 'No orders found'};
            }
    
            return { orders: rows };
        } catch (err) {
            console.error('Error fetching orders:', err);
            return { status: 500, message: 'Internal server error while fetching orders', error: err.message };
        } finally {
            client.release();
        }
    },
    getOrdersByDate: async ({ params }) => {
        const { date } = params;
        
        if (!date) {
            return { status: 400, message: 'Date is required' };
        }
    
        const client = await pool.connect();
        try {
            const queryText = `
                SELECT 
                    o.order_id, 
                    o.customer_name, 
                    o.table_id, 
                    t.table_number,  
                    o.order_date,
                    o.order_status, 
                    o.order_type,
                    -- Calculate total_amount by summing the price of valid items
                    COALESCE(SUM(oi.price), 0) AS total_amount
                FROM Orders o
                LEFT JOIN Tables t ON o.table_id = t.table_id
                LEFT JOIN OrderItems oi ON o.order_id = oi.order_id AND oi.order_item_status != 'Cancelled'
                WHERE DATE(o.order_date) = $1
                GROUP BY o.order_id, o.customer_name, o.table_id, t.table_number, o.order_date, o.order_status, o.order_type
            `;
            
            const { rows } = await client.query(queryText, [date]);
    
            if (rows.length === 0) {
                return { status: 404, message: `No orders found for date: ${date}` };
            }
    
            return { orders: rows };
        } catch (err) {
            console.error('Error fetching orders by date:', err);
            return { status: 500, message: 'Internal server error while fetching orders by date', error: err.message };
        } finally {
            client.release();
        }
    },
    updateStatus: async ({ params, body, set }) => {
        const { order_id } = params;
        const { order_status } = body;
    
        if (!order_id || !order_status) {
            set.status = 400;
            return { message: 'Missing required fields: order_id, order_status' };
        }
    
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
    
            const checkOrderResult = await client.query(
                `SELECT order_id, table_id FROM Orders WHERE order_id = $1`,
                [order_id]
            );
    
            if (checkOrderResult.rowCount === 0) {
                set.status = 404;
                return { message: `Order with ID ${order_id} not found` };
            }
    
            const table_id = checkOrderResult.rows[0].table_id;
            let updateQuery = `UPDATE Orders SET order_status = $1 WHERE order_id = $2`;
            const updateValues = [order_status, order_id];
    
            if (order_status === 'Paid') {
                updateQuery = `
                    UPDATE Orders 
                    SET order_status = $1, payment_date = current_timestamp 
                    WHERE order_id = $2
                `;
            }
    
            const updateStatusResult = await client.query(updateQuery, updateValues);
    
            if (updateStatusResult.rowCount === 0) {
                await client.query('ROLLBACK');
                set.status = 500;
                return { message: 'Failed to update order status' };
            }
    
            // Update table status if order is cancelled or paid
            if ((order_status === 'Cancelled' || order_status === 'Paid') && table_id) {
                await client.query(
                    `UPDATE Tables SET table_status = 'Available' WHERE table_id = $1`,
                    [table_id]
                );
            }
    
            await client.query('COMMIT');
            set.status = 200;
            return { message: 'Order status updated successfully', order_id };
    
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error updating order status:', err);
            set.status = 500;
            return { message: 'Internal server error while updating order status' };
        } finally {
            client.release();
        }
    },
     
    

    // Update payment method (order_id as params)
    updatePaymentMethod: async ({ params, body, set }) => {
        const { order_id } = params;  // Get order_id from URL params
        const { payment_method } = body;
    
        if (!order_id || !payment_method) {
            set.status = 400;
            return { message: 'Missing required fields: order_id, payment_method' };
        }
    
        const client = await pool.connect();
        try {
            // Check if the order exists
            const checkOrderResult = await client.query(
                `SELECT order_id, table_id FROM Orders WHERE order_id = $1`,
                [order_id]
            );
    
            if (checkOrderResult.rowCount === 0) {
                set.status = 404;
                return { message: `Order with ID ${order_id} not found` };
            }
    
            const table_id = checkOrderResult.rows[0].table_id;
    
            // Update the payment method
            const updatePaymentMethodResult = await client.query(
                `UPDATE Orders SET payment_method = $1, order_status = 'Paid' WHERE order_id = $2`,
                [payment_method, order_id]
            );
            
            if (updatePaymentMethodResult.rowCount === 0) {
                set.status = 500;
                return { message: 'Failed to update payment method' };
            }
    
            // Update table status to 'Available' when order is paid
            if (table_id) {
                await client.query(
                    `UPDATE Tables SET table_status = 'Available' WHERE table_id = $1`,
                    [table_id]
                );
            }
    
            set.status = 200;
            return { message: 'Payment method updated successfully', order_id };
    
        } catch (err) {
            console.error('Error updating payment method:', err);
            set.status = 500;
            return { message: 'Internal server error while updating payment method' };
        } finally {
            client.release();
        }
    },
    
    getOrderStatus: async ({ params }) => {
        const { order_id } = params;
    
        if (!order_id) {
            return { status: 400, message: 'Missing required field: order_id' };
        }
    
        const client = await pool.connect();
        try {
            const queryText = `
                SELECT order_id, order_status, customer_name
                FROM Orders 
                WHERE order_id = $1
            `;
            const { rows } = await client.query(queryText, [order_id]);
    
            if (rows.length === 0) {
                return { status: 404, message: `Order with ID ${order_id} not found` };
            }
    
            return { order_id: rows[0].order_id, order_status: rows[0].order_status, customer: rows[0].customer_name };
        } catch (err) {
            console.error('Error fetching order status:', err);
            return { status: 500, message: 'Internal server error while fetching order status' };
        } finally {
            client.release();
        }
    },
    
};

// Validation schema for creating an order
export const validationCreateOrder = t.Object({
    order_id: t.String(),
    customer_name: t.Optional(t.String()),
    table_id: t.Optional(t.String()),
    items: t.Array(
        t.Object({
            menu_id: t.Number(),
            quantity: t.Number(),
            price: t.Number(),
            note: t.String(),
            options: t.Array(
                t.Object({
                    menu_option_id: t.Number(),
                    additional_price: t.Optional(t.Number())
                })
            )
        })
    )
});


export const validationUpdateOrder = t.Object({
    customer_name: t.Optional(t.String()),
    order_status: t.Optional(t.String()),
    payment_method: t.Optional(t.String()),
    items: t.Optional(
        t.Array(
            t.Object({
                order_item_id: t.Number(),
                order_item_status: t.Optional(t.String()),
                options: t.Optional(
                    t.Array(
                        t.Object({
                            menu_option_id: t.Number(),
                            additional_price: t.Optional(t.Number())
                        })
                    )
                )
            })
        )
    )
});