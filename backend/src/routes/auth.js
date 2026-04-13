"use strict";

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { isValidPassword, isValidEmail } = require("../utils/helpers");
const { JWT_SECRET } = require("../middleware/auth");
const systemConfig = require("../utils/systemConfig");

const prisma = new PrismaClient();

const resetCooldownTracker = new Map();

// --------------------------------------------------------------
// POST /auth/resets : request a password reset token
// --------------------------------------------------------
router.post("/resets", async (req, res) => {
  const now = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  const lastRequest = resetCooldownTracker.get(ip);
  if (lastRequest && now - lastRequest < systemConfig.reset_cooldown * 1000) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please wait before trying again." });
  }
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "email is required" });
  }

  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) {
    resetCooldownTracker.set(ip, now);
    return res.status(404).json({ error: "Account not found" });
  }
  resetCooldownTracker.set(ip, now);
  const resetToken = uuidv4();
  const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.account.update({
    where: { id: account.id },
    data: { resetToken, resetTokenExpiry: expiresAt, resetTokenUsed: false },
  });

  return res.status(202).json({
    expiresAt: expiresAt.toISOString(),
    resetToken,
  });
});

// ----------------------------------------------------------------------
// POST /auth/resets/:resetToken : activate account or reset password
// -----------------------------------------------------------------------
router.post("/resets/:resetToken", async (req, res) => {
  const { resetToken } = req.params;
  const { email, password } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "email is required" });
  }
  if (password !== undefined && !isValidPassword(password)) {
    return res.status(400).json({ error: "Invalid password format" });
  }

  const account = await prisma.account.findUnique({ where: { resetToken } });

  if (!account || account.resetTokenUsed) {
    return res.status(401).json({ error: "Invalid reset token or email" });
  }
  if (account.email !== email) {
    return res.status(401).json({ error: "Invalid reset token or email" });
  }
  const now = Date.now();
  if (new Date(account.resetTokenExpiry).getTime() < now) {
    return res.status(410).json({ error: "Reset token has expired" });
  }
  const updateData = { resetTokenUsed: true, resetToken: null };
  if (!account.activated) {
    updateData.activated = true;
  }
  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }
  const updated = await prisma.account.update({ where: { id: account.id }, data: updateData });

  return res.status(200).json({ activated: updated.activated });
});

// ---------------------------------------------
// POST /auth/tokens : login and get JWT
// -------------------------------------------==
router.post("/tokens", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const valid = await bcrypt.compare(password, account.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!account.activated) {
    return res.status(403).json({ error: "Account is not activated" });
  }

  const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const token = jwt.sign(
    { id: account.id, role: account.role, email: account.email },
    JWT_SECRET,
    { expiresIn }
  );
  return res.status(200).json({
    token,
    expiresAt: expiresAt.toISOString(),
  });
});

// -----------------------------------------------
// 405 — method not allowed for defined paths
// -----------------------------------------------
router.all("/resets/:resetToken", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/resets", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/tokens", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);

module.exports = router;
module.exports.resetCooldownTracker = resetCooldownTracker;
