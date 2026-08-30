import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fplRouter from "./fpl";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fplRouter);

export default router;
