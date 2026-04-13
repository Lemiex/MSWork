"use strict";

const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");
const {
  isValidEmail,
  isValidPassword,
  isValidBirthday,
  parsePagination,
} = require("../utils/helpers");
const systemConfig = require("../utils/systemConfig");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const allowed = [
    "first_name",
    "last_name",
    "email",
    "password",
    "phone_number",
    "postal_address",
    "birthday",
  ];
  for (const key of Object.keys(req.body)) {
    if (!allowed.includes(key)) {
      return res.status(400).json({ error: `Unexpected field: ${key}` });
    }
  }

  const {
    first_name,
    last_name,
    email,
    password,
    phone_number,
    postal_address,
    birthday,
  } = req.body;

  if (!first_name || typeof first_name !== "string") {
    return res.status(400).json({ error: "First name is required" });
  }
  if (!last_name || typeof last_name !== "string") {
    return res.status(400).json({ error: "Last name is required" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: "Invalid password format" });
  }
  if (phone_number !== undefined && typeof phone_number !== "string") {
    return res.status(400).json({ error: "Phone number must be a string" });
  }
  if (postal_address !== undefined && typeof postal_address !== "string") {
    return res.status(400).json({ error: "Postal address must be a string" });
  }
  if (birthday !== undefined) {
    if (!isValidBirthday(birthday)) {
      return res
        .status(400)
        .json({ error: "Birthday must be a valid date in YYYY-MM-DD format" });
    }
    if (new Date(birthday) > new Date()) {
      return res.status(400).json({ error: "Birthday cannot be in the future" });
    }
  }

  const existingAccount = await prisma.account.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingAccount) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const resetToken = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        email,
        password: hashedPassword,
        role: "regular",
        activated: false,
        resetToken,
        resetTokenExpiry: expiresAt,
        resetTokenUsed: false,
      },
    });

    const user = await tx.regularUser.create({
      data: {
        id: account.id,
        first_name,
        last_name,
        phone_number: phone_number,
        postal_address: postal_address,
        birthday: birthday,
      },
    });

    return { account, user };
  });

  return res.status(201).json({
    id: result.account.id,
    first_name: result.user.first_name,
    last_name: result.user.last_name,
    email: result.account.email,
    activated: result.account.activated,
    role: result.account.role,
    phone_number: result.user.phone_number,
    postal_address: result.user.postal_address,
    birthday: result.user.birthday,
    createdAt: result.account.createdAt,
    resetToken,
    expiresAt: expiresAt.toISOString(),
  });
});

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  const allowed = ["keyword", "activated", "suspended", "page", "limit"];
  for (const key of Object.keys(req.query)) {
    if (!allowed.includes(key)) {
      return res
        .status(400)
        .json({ error: `Unexpected query parameter: ${key}` });
    }
  }

  const { keyword, activated, suspended } = req.query;
  const where = {};

  if (keyword !== undefined) {
    if (typeof keyword !== "string") {
      return res.status(400).json({ error: "keyword must be a string" });
    }
    const search = keyword.trim();
    where.OR = [
      { first_name: { contains: search } },
      { last_name: { contains: search } },
      { phone_number: { contains: search } },
      { postal_address: { contains: search } },
      { account: { email: { contains: search } } },
    ];
  }

  if (activated !== undefined) {
    if (activated !== "true" && activated !== "false") {
      return res.status(400).json({ error: "activated must be true or false" });
    }
    where.account = {
      ...(where.account || {}),
      activated: activated === "true",
    };
  }

  if (suspended !== undefined) {
    if (suspended !== "true" && suspended !== "false") {
      return res.status(400).json({ error: "suspended must be true or false" });
    }
    where.suspended = suspended === "true";
  }

  const { skip, limit } = parsePagination(req.query);
  const [users, total] = await Promise.all([
    prisma.regularUser.findMany({
      where,
      include: {
        account: { select: { email: true, activated: true, role: true } },
      },
      skip,
      take: limit,
    }),
    prisma.regularUser.count({ where }),
  ]);

  return res.status(200).json({
    count: total,
    results: users.map((u) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.account.email,
      activated: u.account.activated,
      suspended: u.suspended,
      role: u.account.role,
      phone_number: u.phone_number,
      postal_address: u.postal_address,
    })),
  });
});

router.get("/me", requireAuth, requireRole("regular"), async (req, res) => {
  const user = await prisma.regularUser.findUnique({
    where: { id: req.user.id },
    include: {
      account: {
        select: { email: true, activated: true, role: true, createdAt: true },
      },
    },
  });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const now = Date.now();
  const timeoutMs = systemConfig.availability_timeout * 1000;
  const effectiveAvailable =
    user.available && now - new Date(user.lastActiveAt).getTime() <= timeoutMs;

  return res.status(200).json({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.account.email,
    activated: user.account.activated,
    suspended: user.suspended,
    available: effectiveAvailable,
    role: user.account.role,
    phone_number: user.phone_number,
    postal_address: user.postal_address,
    birthday: user.birthday,
    createdAt: user.account.createdAt,
    avatar: user.avatar,
    resume: user.resume,
    biography: user.biography,
  });
});

router.patch("/me", requireAuth, requireRole("regular"), async (req, res) => {
  const allowed = [
    "first_name",
    "last_name",
    "phone_number",
    "postal_address",
    "birthday",
    "avatar",
    "biography",
  ];
  for (const key of Object.keys(req.body)) {
    if (!allowed.includes(key)) {
      return res.status(400).json({ error: `Unexpected field: ${key}` });
    }
  }

  const {
    first_name,
    last_name,
    phone_number,
    postal_address,
    birthday,
    avatar,
    biography,
  } = req.body;

  if (
    first_name !== undefined &&
    (typeof first_name !== "string" || !first_name)
  ) {
    return res
      .status(400)
      .json({ error: "first_name must be a non-empty string" });
  }
  if (
    last_name !== undefined &&
    (typeof last_name !== "string" || !last_name)
  ) {
    return res
      .status(400)
      .json({ error: "last_name must be a non-empty string" });
  }
  if (phone_number !== undefined && typeof phone_number !== "string") {
    return res.status(400).json({ error: "phone_number must be a string" });
  }
  if (postal_address !== undefined && typeof postal_address !== "string") {
    return res.status(400).json({ error: "postal_address must be a string" });
  }
  if (birthday !== undefined && !isValidBirthday(birthday)) {
    return res
      .status(400)
      .json({ error: "birthday must be a valid date in YYYY-MM-DD format" });
  }
  if (birthday !== undefined && new Date(birthday) > new Date()) {
    return res.status(400).json({ error: "Birthday cannot be in the future" });
  }
  if (avatar !== undefined && avatar !== null && typeof avatar !== "string") {
    return res.status(400).json({ error: "avatar must be a string" });
  }
  if (
    biography !== undefined &&
    biography !== null &&
    typeof biography !== "string"
  ) {
    return res.status(400).json({ error: "biography must be a string" });
  }

  const updates = {};
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (phone_number !== undefined) updates.phone_number = phone_number;
  if (postal_address !== undefined) updates.postal_address = postal_address;
  if (birthday !== undefined) updates.birthday = birthday;
  if (avatar !== undefined) updates.avatar = avatar;
  if (biography !== undefined) updates.biography = biography;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No updatable fields provided" });
  }

  const existing = await prisma.regularUser.findUnique({
    where: { id: req.user.id },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }

  const updated = await prisma.regularUser.update({
    where: { id: req.user.id },
    data: updates,
  });

  const response = { id: updated.id };
  if (first_name !== undefined) response.first_name = updated.first_name;
  if (last_name !== undefined) response.last_name = updated.last_name;
  if (phone_number !== undefined) response.phone_number = updated.phone_number;
  if (postal_address !== undefined)
    response.postal_address = updated.postal_address;
  if (birthday !== undefined) response.birthday = updated.birthday;
  if (avatar !== undefined) response.avatar = updated.avatar;
  if (biography !== undefined) response.biography = updated.biography;

  return res.status(200).json(response);
});

router.patch(
  "/me/available",
  requireAuth,
  requireRole("regular"),
  async (req, res) => {
    const { available } = req.body;
    if (typeof available !== "boolean") {
      return res.status(400).json({ error: "available must be a boolean" });
    }

    if (available) {
      const user = await prisma.regularUser.findUnique({
        where: { id: req.user.id },
        include: { account: { select: { activated: true } } },
      });

      if (user.suspended) {
        return res
          .status(400)
          .json({ error: "Cannot set available while account is suspended" });
      }

      const approvedCount = await prisma.qualification.count({
        where: { userId: req.user.id, status: "approved" },
      });
      if (approvedCount === 0) {
        return res
          .status(400)
          .json({
            error: "Cannot set available without approved qualifications",
          });
      }

      await prisma.regularUser.update({
        where: { id: req.user.id },
        data: { available: true, lastActiveAt: new Date() },
      });
    } else {
      await prisma.regularUser.update({
        where: { id: req.user.id },
        data: { available: false },
      });
    }

    return res.status(200).json({ available });
  }
);
router.patch(
  "/:userId/suspended",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const uid = parseInt(req.params.userId, 10);
    if (isNaN(uid)) {
      return res.status(404).json({ error: "User not found" });
    }

    const { suspended } = req.body;
    if (typeof suspended !== "boolean") {
      return res.status(400).json({ error: "suspended must be a boolean" });
    }
    const user = await prisma.regularUser.findUnique({
      where: { id: uid },
      include: {
        account: { select: { email: true, activated: true, role: true } },
      },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await prisma.regularUser.update({
      where: { id: uid },
      data: { suspended },
    });

    return res.status(200).json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.account.email,
      activated: user.account.activated,
      suspended,
      role: user.account.role,
      phone_number: user.phone_number,
      postal_address: user.postal_address,
    });
  }
);

router.get(
  "/me/qualifications",
  requireAuth,
  requireRole("regular"),
  async (req, res) => {
    const qualifications = await prisma.qualification.findMany({
      where: { userId: req.user.id },
      include: {
        positionType: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.status(200).json({
      count: qualifications.length,
      results: qualifications.map((q) => ({
        id: q.id,
        status: q.status,
        note: q.note,
        document: q.document,
        position_type: { id: q.positionType.id, name: q.positionType.name },
        updatedAt: q.updatedAt,
      })),
    });
  }
);

router.get(
  "/me/invitations",
  requireAuth,
  requireRole("regular"),
  async (req, res) => {
    const { skip, limit } = parsePagination(req.query);
    const now = Date.now();
    const windowMs = 1000 * systemConfig.negotiation_window;
    const rows = await prisma.interest.findMany({
      where: {
        candidateId: req.user.id,
        businessInterested: true,
      },
      include: {
        job: {
          include: {
            positionType: { select: { id: true, name: true } },
            business: { select: { id: true, business_name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const invites = rows.filter(
      (r) =>
        r.job.status === "open" && now < r.job.start_time.getTime() - windowMs
    );

    return res.status(200).json({
      count: invites.length,
      results: invites.slice(skip, skip + limit).map((r) => ({
        id: r.job.id,
        status: "open",
        position_type: {
          id: r.job.positionType.id,
          name: r.job.positionType.name,
        },
        business: {
          id: r.job.business.id,
          business_name: r.job.business.business_name,
        },
        salary_min: r.job.salary_min,
        salary_max: r.job.salary_max,
        start_time: r.job.start_time,
        end_time: r.job.end_time,
        updatedAt: r.job.updatedAt,
      })),
    });
  }
);

router.get(
  "/me/interests",
  requireAuth,
  requireRole("regular"),
  async (req, res) => {
    const { skip, limit } = parsePagination(req.query);

    const rows = await prisma.interest.findMany({
      where: { candidateId: req.user.id, candidateInterested: true },
      include: {
        job: {
          include: {
            positionType: { select: { id: true, name: true } },
            business: { select: { id: true, business_name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.status(200).json({
      count: rows.length,
      results: rows.slice(skip, skip + limit).map((r) => ({
        interest_id: r.id,
        mutual: !!(r.candidateInterested && r.businessInterested),
        job: {
          id: r.job.id,
          status: r.job.status,
          position_type: {
            id: r.job.positionType.id,
            name: r.job.positionType.name,
          },
          business: {
            id: r.job.business.id,
            business_name: r.job.business.business_name,
          },
          salary_min: r.job.salary_min,
          salary_max: r.job.salary_max,
          start_time: r.job.start_time,
          end_time: r.job.end_time,
          updatedAt: r.job.updatedAt,
        },
      })),
    });
  }
);

// -------------------------------------------
// errors 405
// -------------------------------------------
router.all("/me/qualifications", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/me/available", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/me/invitations", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/me/interests", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/me", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/:userId/suspended", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);
router.all("/", (_req, res) =>
  res.status(405).json({ error: "Method not allowed" })
);

module.exports = router;
