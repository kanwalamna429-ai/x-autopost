import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import campaignsRouter from "./campaigns";
import urlsRouter from "./urls";
import postsRouter from "./posts";
import xAccountRouter from "./x-account";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(campaignsRouter);
router.use(urlsRouter);
router.use(postsRouter);
router.use(xAccountRouter);
router.use(dashboardRouter);

export default router;
