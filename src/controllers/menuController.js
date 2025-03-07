import { t } from 'elysia';
import pool from '../db/database.js';

export const menuController = {
    getMenus: async () => {
        try {
            const menusResult = await pool.query('SELECT * FROM Menus');

            if (menusResult.rows.length === 0) {
                return { status: 404, message: 'No menus found' };
            }

            const menus = await Promise.all(
                menusResult.rows.map(async (menu) => {
                    const groupsResult = await pool.query(
                        `SELECT * FROM MenuGroups WHERE menu_id = $1`,
                        [menu.menu_id]
                    );

                    const groups = await Promise.all(
                        groupsResult.rows.map(async (group) => {
                            const optionsResult = await pool.query(
                                `SELECT * FROM MenuOptions WHERE menu_group_id = $1`,
                                [group.menu_group_id]
                            );

                            return {
                                ...group,
                                options: optionsResult.rows,
                            };
                        })
                    );

                    return {
                        ...menu,
                        groups,
                    };
                })
            );

            return menus;
        } catch (err) {
            console.error('Error fetching menus:', err);
            return { status: 500, message: 'Internal server error while fetching menus' };
        }
    },

    getMenuById: async ({ params }) => {
        const { menu_id } = params;
        try {
            const menuResult = await pool.query(
                'SELECT * FROM Menus WHERE menu_id = $1',
                [menu_id]
            );

            if (menuResult.rows.length === 0) {
                return { status: 404, message: 'Menu not found' };
            }

            const menu = menuResult.rows[0];

            const groupsResult = await pool.query(
                `SELECT * FROM MenuGroups WHERE menu_id = $1`,
                [menu_id]
            );

            const groups = await Promise.all(
                groupsResult.rows.map(async (group) => {
                    const optionsResult = await pool.query(
                        `SELECT * FROM MenuOptions WHERE menu_group_id = $1`,
                        [group.menu_group_id]
                    );

                    return {
                        ...group,
                        options: optionsResult.rows,
                    };
                })
            );

            return {
                ...menu,
                groups,
            };

        } catch (err) {
            console.error('Error fetching menu by ID:', err);
            return { status: 500, message: 'Internal server error while fetching menu' };
        }
    },

    createMenu: async ({ body, set }) => {
        const { menu_name, price, menu_status, image, groups } = body;

        if (!menu_name || !price || !groups) {
            return { status: 400, message: 'Missing required fields' };
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const insertMenuResult = await client.query(
                `INSERT INTO Menus (menu_name, price, menu_status, image)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [menu_name, price, menu_status || 'Available', image]
            );

            const menuId = insertMenuResult.rows[0].menu_id;
            const createdGroups = [];

            for (const group of groups) {
                const { group_name, is_required, is_multiple, options } = group;

                const insertGroupResult = await client.query(
                    `INSERT INTO MenuGroups (group_name, is_required, is_multiple, menu_id)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [group_name, is_required || false, is_multiple || false, menuId]
                );

                const groupId = insertGroupResult.rows[0].menu_group_id;
                const createdOptions = [];

                for (const option of options) {
                    const { option_name, additional_price } = option;

                    const insertOptionResult = await client.query(
                        `INSERT INTO MenuOptions (option_name, additional_price, menu_group_id)
                         VALUES ($1, $2, $3)
                         RETURNING *`,
                        [option_name, additional_price || 0, groupId]
                    );

                    createdOptions.push(insertOptionResult.rows[0]);
                }

                createdGroups.push({
                    ...insertGroupResult.rows[0],
                    options: createdOptions
                });
            }

            await client.query('COMMIT');

            const createdMenu = {
                ...insertMenuResult.rows[0],
                groups: createdGroups
            };

            set.status = 201;
            return { message: 'Menu created successfully', data: createdMenu };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error creating menu:', err);
            return { status: 500, message: 'Internal server error while creating menu' };
        } finally {
            client.release();
        }
    },

   
    updateMenu: async ({ params, body, set }) => {
        const { menu_id } = params;
        const { menu_name, price, menu_status, image, groups } = body;
    
        if (!menu_id || !menu_name || !price || !groups) {
            return { status: 400, message: 'Missing required fields' };
        }
    
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
    
            const updateMenuResult = await client.query(
                `UPDATE Menus 
                 SET menu_name = $1, price = $2, menu_status = $3, image = $4 
                 WHERE menu_id = $5 RETURNING *`,
                [menu_name, price, menu_status || 'Available', image, menu_id]
            );
    
            if (updateMenuResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return { status: 404, message: 'Menu not found' };
            }
    
            await client.query(`DELETE FROM MenuOptions WHERE menu_group_id IN (SELECT menu_group_id FROM MenuGroups WHERE menu_id = $1)`, [menu_id]);
            await client.query(`DELETE FROM MenuGroups WHERE menu_id = $1`, [menu_id]);
    
            const updatedGroups = [];
            for (const group of groups) {
                const { group_name, is_required, is_multiple, options } = group;
    
                const insertGroupResult = await client.query(
                    `INSERT INTO MenuGroups (group_name, is_required, is_multiple, menu_id) 
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [group_name, is_required || false, is_multiple || false, menu_id]
                );
    
                const groupId = insertGroupResult.rows[0].menu_group_id;
                const updatedOptions = [];
    
                for (const option of options) {
                    const { option_name, additional_price, option_status } = option;
    
                    const insertOptionResult = await client.query(
                        `INSERT INTO MenuOptions (option_name, additional_price, option_status, menu_group_id) 
                         VALUES ($1, $2, $3, $4) RETURNING *`,
                        [option_name, additional_price || 0, option_status, groupId]
                    );
    
                    updatedOptions.push(insertOptionResult.rows[0]);
                }
    
                updatedGroups.push({
                    ...insertGroupResult.rows[0],
                    options: updatedOptions
                });
            }
    
            await client.query('COMMIT');
    
            const updatedMenu = {
                ...updateMenuResult.rows[0],
                groups: updatedGroups
            };
    
            set.status = 200;
            return { message: 'Menu updated successfully', data: updatedMenu };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error updating menu:', err);
            return { status: 500, message: 'Internal server error while updating menu' };
        } finally {
            client.release();
        }
    },
    
    deleteMenu: async ({ params, set }) => {
        const { menu_id } = params;
        if (!menu_id) {
            return { status: 400, message: "Missing menu_id" };
        }
    
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(`DELETE FROM Menus WHERE menu_id = $1 RETURNING *`, [menu_id]);
            if (result.rowCount === 0) {
                await client.query('ROLLBACK');
                return { status: 404, message: 'Menu not found' };
            }
    
            await client.query('COMMIT');
            set.status = 200;
            return { message: 'Menu deleted successfully' };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error deleting menu: ', err);
            return { status: 500, message: 'Internal server error while deleting menu' };
        } finally {
            client.release();
        }
    },    

    validationCreateMenu: t.Object({
        menu_name: t.String(),
        price: t.String(),
        menu_status: t.String(),
        image: t.Optional(t.String()),
        groups: t.Array(
            t.Object({
                group_name: t.String(),
                is_required: t.Boolean(),
                is_multiple: t.Boolean(), // ✅ เพิ่ม validation
                options: t.Array(
                    t.Object({
                        option_name: t.String(),
                        additional_price: t.Optional(t.String())
                    })
                )
            })
        )
    }),
    
    validationUpdateMenu: t.Object({
        menu_name: t.String(),
        price: t.String(),
        menu_status: t.String(),
        image: t.Optional(t.String()),
        groups: t.Array(
            t.Object({
                group_name: t.String(),
                is_required: t.Boolean(),
                is_multiple: t.Boolean(), // ✅ เพิ่ม validation
                options: t.Array(
                    t.Object({
                        option_name: t.String(),
                        additional_price: t.Optional(t.String()),
                        option_status: t.String() // ✅ Add option_status validation
                    })
                )
            })
        )
    }),
};
