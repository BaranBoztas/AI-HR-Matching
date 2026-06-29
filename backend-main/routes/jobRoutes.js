import express from "express";
import {
  createJobPosting,
  getCompanyJobs,
  updateJobPosting,
  deleteJobPosting,
} from "../controllers/jobController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// authMiddleware bu rotayı korur. Sadece geçerli JWT'ye sahip olanlar kontrolcüye ulaşabilir.
router.post("/", authMiddleware, createJobPosting);

router.put("/:id", authMiddleware, updateJobPosting);

router.delete("/:id", authMiddleware, deleteJobPosting);

router.get("/company", authMiddleware, getCompanyJobs);

export default router;
