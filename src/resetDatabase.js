import pool from "./db/database";


export async function resetDatabase() {
    const client = await pool.connect()
    try {

        const resetSQL = `TRUNCATE TABLE Menus, MenuGroups, MenuOptions, Orders, OrderItems, OrderItemOptions, OrderItemHistory RESTART IDENTITY CASCADE;`;
        await client.query(resetSQL);

        console.log('Database reset successfully');
    } catch (error) {
        console.error('Error resetting the database: ', error)
    } finally {
        client.release()
    }
}