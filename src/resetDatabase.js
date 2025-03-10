import pool from "./db/database";

export async function resetDatabase() {
    const client = await pool.connect();
    try {
        const deleteSQL = `
            DELETE FROM OrderItemHistory;
            DELETE FROM OrderItemOptions;
            DELETE FROM OrderItems;
            DELETE FROM Orders;
            DELETE FROM MenuOptions;
            DELETE FROM MenuGroups;
            DELETE FROM Menus;
        `;
        await client.query(deleteSQL);
        console.log('Database reset successfully');
    } catch (error) {
        console.error('Error resetting the database: ', error);
    } finally {
        client.release();
    }
}
