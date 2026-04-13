"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
const IMAGE_TYPES = ["image/png", "image/jpeg"];
const PDF_TYPES = ["application/pdf"];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

//HELPERS
// builds a multer uploader and runs it, then calls onSuccess(req, res) if all good
function handleUpload(req, res, { dir, filename, allowedTypes, onSuccess }) {
  ensureDir(dir);
  const storage = multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => {
      const name = typeof filename === "function" ? filename(file) : filename;
      cb(null, name);
    },
  });
  const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Invalid file type"), false);
    },
  }).single("file");

  upload(req, res, async (err) => {
    if (err)
      return res.status(400).json({ error: err.message || "upload error" });
    if (!req.file) return res.status(400).json({ error: "File is required" });
    await onSuccess(req, res);
  });
}

// PUT /users/me/avatar
router.put(
  "/users/me/avatar",
  requireAuth,
  requireRole("regular"),
  (req, res) => {
    const userId = req.user.id;
    handleUpload(req, res, {
      dir: path.join(UPLOADS_DIR, "users", String(userId)),
      filename: (file) =>
        file.mimetype === "image/png" ? "avatar.png" : "avatar.jpg",
      allowedTypes: IMAGE_TYPES,
      onSuccess: async () => {
        const ext = req.file.mimetype === "image/png" ? ".png" : ".jpg";
        const avatarPath = `/uploads/users/${userId}/avatar${ext}`;
        await prisma.regularUser.update({
          where: { id: userId },
          data: { avatar: avatarPath },
        });
        return res.status(200).json({ avatar: avatarPath });
      },
    });
  }
);

// PUT /businesses/me/avatar
router.put(
  "/businesses/me/avatar",
  requireAuth,
  requireRole("business"),
  (req, res) => {
    const bizId = req.user.id;
    handleUpload(req, res, {
      dir: path.join(UPLOADS_DIR, "businesses", String(bizId)),

      filename: (file) =>
        file.mimetype === "image/png" ? "avatar.png" : "avatar.jpg",

      allowedTypes: IMAGE_TYPES,

      onSuccess: async () => {
        const ext = req.file.mimetype === "image/png" ? ".png" : ".jpg";
        const avatarPath = `/uploads/businesses/${bizId}/avatar${ext}`;
        await prisma.business.update({
          where: { id: bizId },
          data: { avatar: avatarPath },
        });
        return res.status(200).json({ avatar: avatarPath });
      },
    });
  }
);

// PUT /users/me/resume
router.put(
  "/users/me/resume",
  requireAuth,
  requireRole("regular"),

  (req, res) => {
    const userId = req.user.id;
    handleUpload(req, res, {
      dir: path.join(UPLOADS_DIR, "users", String(userId)),
      filename: "resume.pdf",
      allowedTypes: PDF_TYPES,
      onSuccess: async () => {
        const resumePath = `/uploads/users/${userId}/resume.pdf`;
        await prisma.regularUser.update({
          where: { id: userId },
          data: { resume: resumePath },
        });
        return res.status(200).json({ resume: resumePath });
      },
    });
  }
);

// PUT /qualifications/:qualificationId/document
router.put(
  "/qualifications/:qualificationId/document",
  requireAuth,
  requireRole("regular"),
  (req, res) => {
    const qualId = parseInt(req.params.qualificationId, 10);
    if (isNaN(qualId))
      return res.status(404).json({ error: "Qualification not found" });

    const userId = req.user.id;
    handleUpload(req, res, {
      dir: path.join(UPLOADS_DIR, "users", String(userId), "tmp"),
      filename: "document.pdf",
      allowedTypes: PDF_TYPES,
      onSuccess: async () => {
        const qual = await prisma.qualification.findUnique({
          where: { id: qualId },
        });
        if (!qual) {
          if (req.file) fs.unlink(req.file.path, () => { });
          return res.status(404).json({ error: "Qualification not found" });
        }
        if (qual.userId !== userId) {
          if (req.file) fs.unlink(req.file.path, () => { });
          return res.status(403).json({ error: "Forbidden" });
        }

        const destDir = path.join(
          UPLOADS_DIR,
          "users",
          String(userId),
          "position_type",
          String(qual.positionTypeId)
        );
        ensureDir(destDir);
        const destPath = path.join(destDir, "document.pdf");
        fs.renameSync(req.file.path, destPath);

        const docPath = `/uploads/users/${userId}/position_type/${qual.positionTypeId}/document.pdf`;
        await prisma.qualification.update({
          where: { id: qualId },
          data: { document: docPath },
        });
        return res.status(200).json({ document: docPath });
      },
    });
  }
);

// 405 handlers
router.all("/users/me/avatar", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/businesses/me/avatar", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/users/me/resume", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/qualifications/:qualificationId/document", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);

module.exports = router;
