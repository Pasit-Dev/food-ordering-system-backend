import { orderItemController } from "../controllers/orderItemController";


export default function orderItemRoutes(app) {
    return app.put('/:order_item_id/status', orderItemController.updateStatus)
    .get('/:order_id', orderItemController.getOrderItemsByOrderId)
    .get('/best-selling-menu', orderItemController.getBestSellingMenu)
    .get('/top-five-menu', orderItemController.getTopFiveMenu)
}