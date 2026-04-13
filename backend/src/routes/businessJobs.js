'use strict';

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { parsePagination, buildJobStatusWhere, getEffectiveJobStatus, parseDate } = require("../utils/helpers");
const systemConfig = require("../utils/systemConfig");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

function validateSalaryFields(salaryMin, salaryMax) {
    if (typeof salaryMin !== "number" || !Number.isFinite(salaryMin)) {
        return "salary_min must be a number";
    }
    if (typeof salaryMax !== "number" || !Number.isFinite(salaryMax)) {
        return "salary_max must be a number";
    }
    if (salaryMin < 0) {
        return "salary_min must be non-negative";
    }
    if (salaryMax < salaryMin) {
        return "salary_max must be >= salary_min";
    }
    return null;
}

function validateTimeFields(startTime, endTime, now) {
    if (endTime.getTime() <= startTime.getTime()) {
        return "end_time must be after start_time";
    }
    if (startTime.getTime() <= now) {
        return "start_time must be in the future";
    }
    if (endTime.getTime() <= now) {
        return "end_time must be in the future";
    }
    const negotiationWindowMs = systemConfig.negotiation_window * 1000;
    const jobStartWindowMs = systemConfig.job_start_window * 3600 * 1000;
    if (startTime.getTime() - now < negotiationWindowMs) {
        return "start_time must be at least negotiation_window seconds in the future";
    }
    if (startTime.getTime() - now > jobStartWindowMs) {
        return "start_time must be within job_start_window hours from now";
    }
    return null;
}

router.post("/", requireAuth, requireRole("business"), async (req, res) => {
    const business = await prisma.business.findUnique({
        where: { id: req.user.id },
        select: { id: true, verified: true },
    });
    if (!business) {
        return res.status(404).json({ error: "Business not found" });
    }
    if (!business.verified) {
        return res.status(403).json({ error: "Business must be verified to create jobs" });
    }

    const allowed = ["position_type_id", "salary_min", "salary_max", "start_time", "end_time", "note"];
    for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
    }

    const { position_type_id, salary_min, salary_max, start_time, end_time, note } = req.body;

    if (typeof position_type_id !== "number" || !Number.isInteger(position_type_id)) {
        return res.status(400).json({ error: "position_type_id is required and must be an integer" });
    }

    const salaryErr = validateSalaryFields(salary_min, salary_max);
    if (salaryErr) return res.status(400).json({ error: salaryErr });

    if (!start_time || typeof start_time !== "string") {
        return res.status(400).json({ error: "start_time is required" });
    }
    if (!end_time || typeof end_time !== "string") {
        return res.status(400).json({ error: "end_time is required" });
    }

    const startTime = parseDate(start_time);
    if (!startTime) {
        return res.status(400).json({ error: "start_time must be a valid date" });
    }
    const endTime = parseDate(end_time);
    if (!endTime) {
        return res.status(400).json({ error: "end_time must be a valid date" });
    }

    const now = Date.now();
    const timeErr = validateTimeFields(startTime, endTime, now);
    if (timeErr) return res.status(400).json({ error: timeErr });

    if (note !== undefined && typeof note !== "string") {
        return res.status(400).json({ error: "note must be a string" });
    }

    const positionType = await prisma.positionType.findUnique({
        where: { id: position_type_id },
    });
    if (!positionType || positionType.hidden) {
        return res.status(400).json({ error: "Invalid or hidden position type" });
    }

    const job = await prisma.job.create({
        data: {
            positionTypeId: position_type_id,
            businessId: req.user.id,
            salary_min,
            salary_max,
            start_time: startTime,
            end_time: endTime,
            note: note ?? "",
        },
        include: {
            positionType: { select: { id: true, name: true } },
            business: { select: { id: true, business_name: true } },
        },
    });

    return res.status(201).json({
        id: job.id,
        status: job.status,
        position_type: { id: job.positionType.id, name: job.positionType.name },
        business: { id: job.business.id, business_name: job.business.business_name },
        worker: null,
        note: job.note,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        start_time: job.start_time,
        end_time: job.end_time,
        updatedAt: job.updatedAt,
    });
});

router.get("/", requireAuth, requireRole("business"), async (req, res) => {
    const allowed = ["position_type_id", "salary_min", "salary_max", "start_time", "end_time", "status", "page", "limit"];
    for (const key of Object.keys(req.query)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected query parameter: ${key}` });
        }
    }

    const now = Date.now();
    const where = { businessId: req.user.id };

    const validStatuses = ["open", "expired", "filled", "completed", "canceled"];
    let statuses;
    if (req.query.status !== undefined) {
        statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
        for (const s of statuses) {
            if (!validStatuses.includes(s)) {
                return res.status(400).json({ error: `Invalid status: ${s}` });
            }
        }
    } else {
        statuses = ["open", "filled"];
    }
    const statusWhere = buildJobStatusWhere(statuses, now);
    Object.assign(where, statusWhere);

    if (req.query.position_type_id !== undefined) {
        const ptId = parseInt(req.query.position_type_id, 10);
        if (isNaN(ptId)) {
            return res.status(400).json({ error: "position_type_id must be a number" });
        }
        where.positionTypeId = ptId;
    }

    if (req.query.salary_min !== undefined) {
        const val = parseFloat(req.query.salary_min);
        if (!Number.isFinite(val)) {
            return res.status(400).json({ error: "salary_min must be a number" });
        }
        where.salary_min = { gte: val };
    }

    if (req.query.salary_max !== undefined) {
        const val = parseFloat(req.query.salary_max);
        if (!Number.isFinite(val)) {
            return res.status(400).json({ error: "salary_max must be a number" });
        }
        where.salary_max = { ...(where.salary_max || {}), gte: val };
    }

    if (req.query.start_time !== undefined) {
        const dt = new Date(req.query.start_time);
        if (isNaN(dt.getTime())) {
            return res.status(400).json({ error: "start_time must be a valid date" });
        }
        where.start_time = { ...(where.start_time || {}), gte: dt };
    }

    if (req.query.end_time !== undefined) {
        const dt = new Date(req.query.end_time);
        if (isNaN(dt.getTime())) {
            return res.status(400).json({ error: "end_time must be a valid date" });
        }
        where.end_time = { ...(where.end_time || {}), lte: dt };
    }

    const { skip, limit } = parsePagination(req.query);
    const [jobs, total] = await Promise.all([
        prisma.job.findMany({
            where,
            include: {
                positionType: { select: { id: true, name: true } },
                worker: { select: { id: true, first_name: true, last_name: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.job.count({ where }),
    ]);

    return res.status(200).json({
        count: total,
        results: jobs.map((job) => ({
            id: job.id,
            status: getEffectiveJobStatus(job, now),
            position_type: { id: job.positionType.id, name: job.positionType.name },
            business_id: job.businessId,
            worker: job.worker ? { id: job.worker.id, first_name: job.worker.first_name, last_name: job.worker.last_name } : null,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            start_time: job.start_time,
            end_time: job.end_time,
            updatedAt: job.updatedAt,
        })),
    });
});

router.patch("/:jobId", requireAuth, requireRole("business"), async (req, res) => {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
        return res.status(404).json({ error: "Job not found" });
    }

    const job = await prisma.job.findUnique({
        where: { id: jobId },
    });
    if (!job || job.businessId !== req.user.id) {
        return res.status(404).json({ error: "Job not found" });
    }

    const now = Date.now();
    const effectiveStatus = getEffectiveJobStatus(job, now);
    if (effectiveStatus !== "open") {
        return res.status(409).json({ error: "Job is no longer in the open state" });
    }

    const allowed = ["salary_min", "salary_max", "start_time", "end_time", "note"];
    for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
    }

    const { salary_min, salary_max, start_time, end_time, note } = req.body;
    const updates = {};

    let finalSalaryMin = job.salary_min;
    let finalSalaryMax = job.salary_max;
    let finalStartTime = job.start_time;
    let finalEndTime = job.end_time;

    if (salary_min !== undefined) {
        if (typeof salary_min !== "number" || !Number.isFinite(salary_min)) {
            return res.status(400).json({ error: "salary_min must be a number" });
        }
        finalSalaryMin = salary_min;
        updates.salary_min = salary_min;
    }
    if (salary_max !== undefined) {
        if (typeof salary_max !== "number" || !Number.isFinite(salary_max)) {
            return res.status(400).json({ error: "salary_max must be a number" });
        }
        finalSalaryMax = salary_max;
        updates.salary_max = salary_max;
    }
    const salaryErr = validateSalaryFields(finalSalaryMin, finalSalaryMax);
    if (salaryErr) return res.status(400).json({ error: salaryErr });

    if (start_time !== undefined) {
        const st = parseDate(start_time);
        if (!st) {
            return res.status(400).json({ error: "start_time must be a valid date" });
        }
        finalStartTime = st;
        updates.start_time = st;
    }
    if (end_time !== undefined) {
        const et = parseDate(end_time);
        if (!et) {
            return res.status(400).json({ error: "end_time must be a valid date" });
        }
        finalEndTime = et;
        updates.end_time = et;
    }

    const timeErr = validateTimeFields(new Date(finalStartTime), new Date(finalEndTime), now);
    if (timeErr) return res.status(400).json({ error: timeErr });

    if (note !== undefined) {
        if (typeof note !== "string") {
            return res.status(400).json({ error: "note must be a string" });
        }
        updates.note = note;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
    }

    const updated = await prisma.job.update({
        where: { id: jobId },
        data: updates,
    });

    const response = { id: updated.id };
    if (salary_min !== undefined) response.salary_min = updated.salary_min;
    if (salary_max !== undefined) response.salary_max = updated.salary_max;
    if (start_time !== undefined) response.start_time = updated.start_time;
    if (end_time !== undefined) response.end_time = updated.end_time;
    if (note !== undefined) response.note = updated.note;
    response.updatedAt = updated.updatedAt;

    return res.status(200).json(response);
});

router.delete("/:jobId", requireAuth, requireRole("business"), async (req, res) => {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
        return res.status(404).json({ error: "Job not found" });
    }

    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { negotiations: { where: { status: "active" } } },
    });
    if (!job || job.businessId !== req.user.id) {
        return res.status(404).json({ error: "Job not found" });
    }

    const now = Date.now();
    const effectiveStatus = getEffectiveJobStatus(job, now);
    if (effectiveStatus !== "open" && effectiveStatus !== "expired") {
        return res.status(409).json({ error: "Job must be in open or expired state to delete" });
    }

    if (job.negotiations.length > 0) {
        return res.status(409).json({ error: "Cannot delete a job with active negotiations" });
    }

    await prisma.$transaction(async (tx) => {
        await tx.negotiation.deleteMany({ where: { jobId } });
        await tx.interest.deleteMany({ where: { jobId } });
        await tx.job.delete({ where: { id: jobId } });
    });

    return res.status(204).send();
});

router.all("/", (_req, res) => res.status(405).json({ error: "Method not allowed" }));
router.all("/:jobId", (_req, res) => res.status(405).json({ error: "Method not allowed" }));

module.exports = router;
