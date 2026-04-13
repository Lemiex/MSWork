"use strict";

const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
const prisma = new PrismaClient();

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    // Refresh lastActiveAt for regular users so availability timeout doesn't
    // expire while the user is actively using the platform.
    if (req.user.role === "regular") {
      prisma.regularUser.updateMany({
        where: { id: req.user.id, available: true },
        data: { lastActiveAt: new Date() },
      }).catch(() => {});
    }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
