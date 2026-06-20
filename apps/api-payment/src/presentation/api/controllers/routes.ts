import { Router } from "express";
import { createProductController } from "./product/CreateProductController";
import { findManyProductController } from "./product/FindManyProductController";
import { createOrderController } from "./order/CreateOrderController";
import { findManyOrderController } from "./order/FindManyOrderController";
import { getOrderStatusController } from "./order/GetOrderStatusController";

export const router = Router();

router.post("/products", createProductController);
router.get("/products", findManyProductController);

router.post("/orders", createOrderController);
router.get("/orders", findManyOrderController);
router.get("/orders/:orderId/status", getOrderStatusController);
