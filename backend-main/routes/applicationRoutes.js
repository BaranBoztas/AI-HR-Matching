import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  applyForJob,
  getCandidateApplications,
  getCompanyApplications,
  updateApplicationStatus,
  makeOfferToCandidate,
  getCandidateOffers,
  respondToOffer,
} from "../controllers/applicationController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", applyForJob);

router.get("/candidate", getCandidateApplications);

router.get("/candidate/offers", getCandidateOffers);

router.get("/company", getCompanyApplications);

router.put("/:id", updateApplicationStatus);

router.post("/offer", makeOfferToCandidate);

router.put("/:id/respond", respondToOffer);

export default router;
