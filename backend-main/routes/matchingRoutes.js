import express from "express";
import {
  matchCandidateWithJobs,
  matchJobWithCandidates,
} from "../controllers/matchingController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/candidate/:candidateId", authMiddleware, matchCandidateWithJobs);

router.get("/job/:jobId", authMiddleware, matchJobWithCandidates);

export default router;
