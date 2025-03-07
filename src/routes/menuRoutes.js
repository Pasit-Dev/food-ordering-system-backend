import { t } from 'elysia';
import { menuController } from '../controllers/menuController';

export default function menuRoutes(app) {
    return app
        .get('/', menuController.getMenus)
        .get('/:menu_id', menuController.getMenuById)
        .guard({ body: menuController.validationCreateMenu }, (guardApp) =>
            guardApp.post('/', menuController.createMenu)
        )
        .guard({ body: menuController.validationUpdateMenu}, (guardApp) => 
            guardApp.put('/:menu_id', menuController.updateMenu))
        .delete('/:menu_id', menuController.deleteMenu)
      
}
