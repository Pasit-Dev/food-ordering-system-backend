import { orderController, validationCreateOrder, validationUpdateOrder } from "../controllers/orderController"

export default function orderRoutes(app)  {
    return app.guard({ body: validationCreateOrder }, (guardApp) => 
            guardApp.post("/", orderController.createOrder))
  .get('/', orderController.getOrders)
  .get('/:date', orderController.getOrdersByDate)
  .put('/:order_id/status', orderController.updateStatus)
  .put('/:order_id/payment-method', orderController.updatePaymentMethod)
}