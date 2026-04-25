import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import profileRouter from "./profile.js";
import catalogRouter from "./catalog.js";
import metaRouter from "./meta.js";
import ordersRouter from "./orders.js";
import depositsRouter from "./deposits.js";
import telegramAdminRouter from "./telegram-admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(catalogRouter);
router.use(metaRouter);
router.use(ordersRouter);
router.use(depositsRouter);
router.use(telegramAdminRouter);

export default router;
