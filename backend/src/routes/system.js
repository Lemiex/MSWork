"use strict";

const express = require("express");
const router = express.Router();
const systemConfig = require("../utils/systemConfig");
const { requireAuth, requireRole } = require("../middleware/auth");

// -------------------------------
// GET /system
// --------------------------------
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  (_req, res) => {
    return res.status(200).json({
      reset_cooldown: systemConfig.reset_cooldown,
      negotiation_window: systemConfig.negotiation_window,
      job_start_window: systemConfig.job_start_window,
      availability_timeout: systemConfig.availability_timeout,
    });
  }
);

router.all("/", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);

// -------------------------------
// PATCH /system/reset-cooldown
// --------------------------------
router.patch(
  "/reset-cooldown",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const allowed = ["reset_cooldown"];
    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key))
        return res.status(400).json({ error: `Unexpected field: ${key}` });
    }
    const { reset_cooldown } = req.body;
    if (reset_cooldown === undefined || typeof reset_cooldown !== "number") {
      return res
        .status(400)
        .json({ error: "reset_cooldown is required and must be a number" });
    }
    if (reset_cooldown < 0) {
      return res.status(400).json({ error: "reset_cooldown must be >= 0" });
    }
    systemConfig.reset_cooldown = reset_cooldown;
    return res.status(200).json({ reset_cooldown });
  }
);

// ------------------------------------------------------------------------
// PATCH /system/negotiation-window
// ------------------------------------------------------------------------
router.patch(
  "/negotiation-window",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const allowed = ["negotiation_window"];
    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key))
        return res.status(400).json({ error: `Unexpected field: ${key}` });
    }

    const { negotiation_window } = req.body;
    if (
      negotiation_window === undefined ||
      typeof negotiation_window !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "negotiation_window is required and must be a number" });
    }
    if (negotiation_window <= 0) {
      return res.status(400).json({ error: "negotiation_window must be > 0" });
    }
    systemConfig.negotiation_window = negotiation_window;
    return res.status(200).json({ negotiation_window });
  }
);

// -----------------------------------------
// PATCH /system/job-start-window
// -----------------------------------------
router.patch(
  "/job-start-window",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const allowed = ["job_start_window"];
    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key))
        return res.status(400).json({ error: `Unexpected field: ${key}` });
    }
    const { job_start_window } = req.body;
    if (
      job_start_window === undefined ||
      typeof job_start_window !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "job_start_window is required and must be a number" });
    }
    if (job_start_window <= 0) {
      return res.status(400).json({ error: "job_start_window must be > 0" });
    }
    systemConfig.job_start_window = job_start_window;
    return res.status(200).json({ job_start_window });
  }
);

// --------------------------------------
// PATCH /system/availability-timeout
// -----------------------------------------
router.patch(
  "/availability-timeout",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const allowed = ["availability_timeout"];
    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key))
        return res.status(400).json({ error: `Unexpected field: ${key}` });
    }
    const { availability_timeout } = req.body;
    if (
      availability_timeout === undefined ||
      typeof availability_timeout !== "number"
    ) {
      return res.status(400).json({
        error: "availability_timeout is required and must be a number",
      });
    }
    if (availability_timeout <= 0) {
      return res
        .status(400)
        .json({ error: "availability_timeout must be > 0" });
    }
    systemConfig.availability_timeout = availability_timeout;
    return res.status(200).json({ availability_timeout });
  }
);

// -------------------------------------------
// errors 405
// --------------------------------------------
router.all("/reset-cooldown", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/negotiation-window", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/job-start-window", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/availability-timeout", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);

module.exports = router;
