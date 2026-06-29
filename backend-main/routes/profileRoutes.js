import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getProfile);

router.put("/", updateProfile);

export default router;
