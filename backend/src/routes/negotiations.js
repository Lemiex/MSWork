"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { getEffectiveJobStatus, isDiscoverable, parsePagination } = require("../utils/helpers");
const systemConfig = require("../utils/systemConfig");
const { requireAuth } = require("../middleware/auth");
const { getIO } = require("../socket");

const router = express.Router();
const prisma = new PrismaClient();

// Shared include for full negotiation data
const NEG_INCLUDE = {
  job: {
    include: {
      positionType: { select: { id: true, name: true } },
      business: { select: { id: true, business_name: true } },
    },
  },
  interest: {
    include: {
      candidate: { select: { id: true, first_name: true, last_name: true } },
    },
  },
};

function shapeNeg(neg, now) {
  return {
    id: neg.id,
    status: neg.status,
    createdAt: neg.createdAt,
    updatedAt: neg.updatedAt,
    expiresAt: neg.expiresAt,
    job: {
      id: neg.job.id,
      status: getEffectiveJobStatus(neg.job, now),
      position_type: { id: neg.job.positionType.id, name: neg.job.positionType.name },
      business: { id: neg.job.business.id, business_name: neg.job.business.business_name },
      salary_min: neg.job.salary_min,
      salary_max: neg.job.salary_max,
      start_time: neg.job.start_time,
      end_time: neg.job.end_time,
    },
    candidate: neg.interest.candidate,
    decisions: {
      candidate: neg.candidateDecision,
      business: neg.businessDecision,
    },
  };
}

// POST /negotiations
router.post("/", requireAuth, async (req, res) => {
  const role = req.user.role;
  if (role !== "regular" && role !== "business") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { interest_id } = req.body;
  if (typeof interest_id !== "number" || !Number.isInteger(interest_id)) {
    return res.status(400).json({ error: "interest_id is required and must be an integer" });
  }

  const interest = await prisma.interest.findUnique({
    where: { id: interest_id },
    include: {
      job: {
        include: {
          positionType: { select: { id: true, name: true } },
          business: { select: { id: true, business_name: true } },
        },
      },
    },
  });
  if (!interest) {
    return res.status(404).json({ error: "Interest not found" });
  }

  const isBusiness = role === "business" && req.user.id === interest.job.businessId;
  const isCandidate = role === "regular" && req.user.id === interest.candidateId;
  if (!isBusiness && !isCandidate) {
    return res.status(404).json({ error: "Interest not found" });
  }

  if (interest.candidateInterested !== true || interest.businessInterested !== true) {
    return res.status(403).json({ error: "Interest is not mutual" });
  }

  const now = Date.now();
  const effectiveStatus = getEffectiveJobStatus(interest.job, now);
  if (effectiveStatus !== "open") {
    return res.status(409).json({ error: "Job is no longer available for negotiation" });
  }

  const candidate = await prisma.regularUser.findUnique({
    where: { id: interest.candidateId },
    include: {
      account: { select: { activated: true } },
      qualifications: true,
    },
  });
  const filledJobs = await prisma.job.findMany({
    where: { workerId: interest.candidateId, status: "filled" },
  });
  if (!isDiscoverable(candidate, candidate.account, candidate.qualifications, filledJobs, interest.job, now)) {
    return res.status(403).json({ error: "Candidate is not currently discoverable for this job" });
  }

  // No-op: return existing active negotiation for this interest
  const existingNeg = await prisma.negotiation.findFirst({
    where: { interestId: interest_id, status: "active" },
    include: NEG_INCLUDE,
  });
  if (existingNeg) {
    return res.status(200).json(shapeNeg(existingNeg, now));
  }

  const negotiationWindowMs = systemConfig.negotiation_window * 1000;
  const expiresAt = new Date(now + negotiationWindowMs);

  const negotiation = await prisma.negotiation.create({
    data: {
      interestId: interest_id,
      jobId: interest.job.id,
      candidateId: interest.candidateId,
      businessId: interest.job.businessId,
      expiresAt,
    },
    include: NEG_INCLUDE,
  });

  const io = getIO();
  if (io) {
    const room = `negotiation:${negotiation.id}`;
    io.in(`account:${interest.candidateId}`).socketsJoin(room);
    io.in(`account:${interest.job.businessId}`).socketsJoin(room);
    io.to(`account:${interest.candidateId}`).emit("negotiation:started", { negotiation_id: negotiation.id });
    io.to(`account:${interest.job.businessId}`).emit("negotiation:started", { negotiation_id: negotiation.id });
  }

  return res.status(201).json(shapeNeg(negotiation, now));
});

// GET /negotiations/me — list all negotiations for the current user
router.get("/me", requireAuth, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== "regular" && role !== "business") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = Date.now();
  const idField = role === "regular" ? "candidateId" : "businessId";
  const { skip, limit } = parsePagination(req.query);

  const [total, negs] = await Promise.all([
    prisma.negotiation.count({ where: { [idField]: userId } }),
    prisma.negotiation.findMany({
      where: { [idField]: userId },
      include: NEG_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return res.status(200).json({
    count: total,
    results: negs.map((neg) => shapeNeg(neg, now)),
  });
});

// GET /negotiations/:id — single negotiation detail
router.get("/:negotiationId", requireAuth, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== "regular" && role !== "business") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const negotiationId = parseInt(req.params.negotiationId, 10);
  if (isNaN(negotiationId)) return res.status(404).json({ error: "Negotiation not found" });

  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: NEG_INCLUDE,
  });
  if (!neg) return res.status(404).json({ error: "Negotiation not found" });

  const isParty =
    (role === "regular" && neg.candidateId === userId) ||
    (role === "business" && neg.businessId === userId);
  if (!isParty) return res.status(404).json({ error: "Negotiation not found" });

  return res.status(200).json(shapeNeg(neg, Date.now()));
});

// PATCH /negotiations/me/decision
router.patch("/me/decision", requireAuth, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== "regular" && role !== "business") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { decision, negotiation_id } = req.body;
  if (!decision || !["accept", "decline"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'accept' or 'decline'" });
  }
  if (typeof negotiation_id !== "number" || !Number.isInteger(negotiation_id)) {
    return res.status(400).json({ error: "negotiation_id is required and must be an integer" });
  }

  const now = Date.now();
  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiation_id },
    include: { job: true, interest: true },
  });
  if (!neg) return res.status(404).json({ error: "Negotiation not found" });

  const isCandidate = role === "regular" && neg.candidateId === userId;
  const isBusiness = role === "business" && neg.businessId === userId;
  if (!isCandidate && !isBusiness) {
    return res.status(404).json({ error: "Negotiation not found" });
  }

  if (neg.status !== "active") {
    return res.status(409).json({ error: "Negotiation is not active" });
  }
  if (new Date(neg.expiresAt).getTime() <= now) {
    return res.status(409).json({ error: "Negotiation has expired" });
  }

  const myField = isCandidate ? "candidateDecision" : "businessDecision";
  const theirDecision = isCandidate ? neg.businessDecision : neg.candidateDecision;

  let newStatus = "active";
  if (decision === "decline") {
    newStatus = "failed";
  } else if (decision === "accept" && theirDecision === "accept") {
    newStatus = "success";
  }
  const dataToSave = { [myField]: decision, status: newStatus };
  let result;

  if (newStatus === "success") {
    result = await prisma.$transaction(async (tx) => {
      const updated = await tx.negotiation.update({ where: { id: neg.id }, data: dataToSave });
      await tx.job.update({ where: { id: neg.jobId }, data: { status: "filled", workerId: neg.candidateId } });
      await tx.regularUser.update({ where: { id: neg.candidateId }, data: { lastActiveAt: new Date(now) } });
      return updated;
    });
  } else if (newStatus === "failed") {
    result = await prisma.$transaction(async (tx) => {
      const updated = await tx.negotiation.update({ where: { id: neg.id }, data: dataToSave });
      await tx.interest.update({
        where: { id: neg.interestId },
        data: { candidateInterested: null, businessInterested: null },
      });
      await tx.regularUser.update({ where: { id: neg.candidateId }, data: { lastActiveAt: new Date(now) } });
      return updated;
    });
  } else {
    result = await prisma.negotiation.update({ where: { id: neg.id }, data: dataToSave });
  }

  return res.status(200).json({
    id: result.id,
    status: result.status,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    expiresAt: result.expiresAt,
    decisions: {
      candidate: result.candidateDecision,
      business: result.businessDecision,
    },
  });
});

router.all("/me/decision", (_req, res) => res.status(405).json({ error: "Method not allowed" }));
router.all("/me", (_req, res) => res.status(405).json({ error: "Method not allowed" }));
router.all("/:negotiationId", (_req, res) => res.status(405).json({ error: "Method not allowed" }));
router.all("/", (_req, res) => res.status(405).json({ error: "Method not allowed" }));

module.exports = router;
