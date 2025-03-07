import { t } from "elysia";
import { tableController } from "../controllers/tableController";

export default function tableRoutes(app) {
    return app.get("/", tableController.getTables)
    .get('/:table_id', tableController.getTableById)
    .get('/order/:table_id', tableController.getOrderFromTable)
    .guard({ body: tableController.validationCreateTable }, (guardApp) => 
        guardApp.post("/", tableController.createTable))
    .delete("/:table_id", tableController.deleteTable)  // เพิ่ม route สำหรับการลบตาราง
    .guard({ body: tableController.validationUpdateTable }, (guardApp) => 
        guardApp.put("/:table_id", tableController.updateTable))  // เพิ่ม route สำหรับการอัพเดตตาราง
};
