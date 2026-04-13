"use strict";

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { parsePagination } = require("../utils/helpers");
const { requireAuth, requireRole } = require("../middleware/auth");

const prisma = new PrismaClient();

// --------------------------------------------------------------
// POST /position-types: create position type (Admin)
// ---------------------------------------------------------------
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const allowed = ["name", "description", "hidden"];
  for (const key of Object.keys(req.body)) {
    if (!allowed.includes(key))
      return res.status(400).json({ error: `Unexpected field: ${key}` });
  }
  const { name, description, hidden } = req.body;
  if (!name || typeof name !== "string")
    return res.status(400).json({ error: "name is required" });
  if (!description || typeof description !== "string")
    return res.status(400).json({ error: "description is required" });
  if (hidden !== undefined && typeof hidden !== "boolean")
    return res.status(400).json({ error: "hidden must be a boolean" });

  const pt = await prisma.positionType.create({
    data: {
      name,
      description,
      hidden: hidden !== undefined ? hidden : true,
    },
  });
  return res.status(201).json({
    id: pt.id,
    name: pt.name,
    description: pt.description,
    hidden: pt.hidden,
    num_qualified: 0,
  });
});

// ---------------------------------------------------------------------------
// GET /position-types: list position types (regular, business, admin
// -------------------------------------------------------------------------
router.get(
  "/",
  requireAuth,
  requireRole("regular", "business", "admin"),
  async (req, res) => {
    const isAdmin = req.user.role === "admin";
    const allowedForAll = ["keyword", "name", "page", "limit"];
    const allowedForAdmin = [...allowedForAll, "hidden", "num_qualified"];
    const allowed = isAdmin ? allowedForAdmin : allowedForAll;

    for (const key of Object.keys(req.query)) {
      if (!allowed.includes(key))
        return res
          .status(400)
          .json({ error: `Unexpected query parameter: ${key}` });
    }

    const { keyword, name, hidden, num_qualified } = req.query;
    const { skip, limit } = parsePagination(req.query);
    const where = {};
    // non admins can only see non hidden position types
    if (!isAdmin) {
      where.hidden = false;
    } else if (hidden !== undefined) {
      const val = hidden === "true" ? true : hidden === "false" ? false : null;
      if (val === null)
        return res.status(400).json({ error: "hidden must be true or false" });
      where.hidden = val;
    }

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    // for admins, sort by num_qualified first, then by name
    let orderBy = [];
    if (!isAdmin) {
      if (name) {
        const nameOrder = name === "desc" ? "desc" : "asc";
        orderBy = [{ name: nameOrder }];
      }
    }

    const pts = await prisma.positionType.findMany({
      where,
      include: {
        qualifications: {
          select: { id: true },
        },
      },
      orderBy: orderBy.length > 0 ? orderBy : undefined,
    });
    let results = pts.map((pt) => ({
      id: pt.id,
      name: pt.name,
      description: pt.description,
      num_qualified: pt.qualifications.length,
      hidden: pt.hidden,
    }));
    if (isAdmin) {
      const numQualOrder = num_qualified === "desc" ? -1 : 1;
      const nameOrder = name === "desc" ? -1 : 1;
      results.sort((a, b) => {
        const diff = (a.num_qualified - b.num_qualified) * numQualOrder;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name) * nameOrder;
      });
    } else if (name) {
      const nameOrder = name === "desc" ? -1 : 1;
      results.sort((a, b) => a.name.localeCompare(b.name) * nameOrder);
    }
    const total = results.length;
    const paginated = results.slice(skip, skip + limit);
    return res.status(200).json({
      count: total,
      results: paginated.map((pt) => {
        const base = { id: pt.id, name: pt.name, description: pt.description };
        if (isAdmin) {
          base.hidden = pt.hidden;
          base.num_qualified = pt.num_qualified;
        }
        return base;
      }),
    });
  }
);

// -----------------------------------------------------------------------
// PATCH /position-types/:positionTypeId : update position type (for admin)
// -------------------------------------------------------------------------
router.patch(
  "/:positionTypeId",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const positionTypeId = parseInt(req.params.positionTypeId);
    if (isNaN(positionTypeId))
      return res.status(404).json({ error: "Position type not found" });
    const allowed = ["name", "description", "hidden"];
    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key))
        return res.status(400).json({ error: `Unexpected field: ${key}` });
    }
    const { name, description, hidden } = req.body;
    if (name !== undefined && typeof name !== "string")
      return res.status(400).json({ error: "name must be a string" });
    if (description !== undefined && typeof description !== "string")
      return res.status(400).json({ error: "description must be a string" });
    if (hidden !== undefined && typeof hidden !== "boolean")
      return res.status(400).json({ error: "hidden must be a boolean" });
    const pt = await prisma.positionType.findUnique({
      where: { id: positionTypeId },
    });
    if (!pt) return res.status(404).json({ error: "Position type not found" });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (hidden !== undefined) updates.hidden = hidden;
    await prisma.positionType.update({
      where: { id: positionTypeId },
      data: updates,
    });

    return res.status(200).json({ id: positionTypeId, ...updates });
  }
);

// -----------------------------------------------------------------------
// DELETE /position-types/:positionTypeId : delete position type (admin)
// --------------------------------------------------------------------------
router.delete(
  "/:positionTypeId",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const positionTypeId = parseInt(req.params.positionTypeId);
    if (isNaN(positionTypeId))
      return res.status(404).json({ error: "Position type not found" });
    const pt = await prisma.positionType.findUnique({
      where: { id: positionTypeId },
    });
    if (!pt) return res.status(404).json({ error: "Position type not found" });
    const [numQualifications, numJobs] = await Promise.all([
      prisma.qualification.count({ where: { positionTypeId } }),
      prisma.job.count({ where: { positionTypeId } }),
    ]);
    if (numQualifications > 0)
      return res
        .status(409)
        .json({ error: "Position type has qualified users" });
    if (numJobs > 0)
      return res
        .status(409)
        .json({ error: "Position type is used by existing jobs" });

    await prisma.positionType.delete({ where: { id: positionTypeId } });
    return res.status(204).send();
  }
);

// ---------------------------------------------------------------------------
// 405 — method not allowed for defined paths
// ---------------------------------------------------------------------------
router.all("/:positionTypeId", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);

module.exports = router;
