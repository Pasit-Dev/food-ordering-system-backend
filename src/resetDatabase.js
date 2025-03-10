import pool from "./db/database";


const resetDatabase = async () => {
    try {
        await pool.connect();
        const resetSQL = `TRUNCATE TABLE Menus, MenuGroups, MenuOptions, Orders, OrderItems, OrderItemOptions, OrderItemHistory RESTART INDENTITY CASCADE;`;
        await pool.query(resetSQL);

        console.log('Database reset successfully');
    } catch (error) {
        console.error('Error resetting the database: ', error)
    } finally {
        await pool.release();
    }
}