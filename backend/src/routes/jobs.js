"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const {
    parsePagination,
    haversineDistance,
    computeEta,
    getEffectiveJobStatus,
    parseLatLon,
    isDiscoverable,
} = require("../utils/helpers");
const systemConfig = require("../utils/systemConfig");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.param("jobId", (req, res, next, value) => {
    if (!/^\d+$/.test(value)) {
        return res.status(404).json({ error: "Not found" });
    }
    next();
});

router.get("/", requireAuth, requireRole("regular"), async (req, res) => {
    const allowed = [
        "lat",
        "lon",
        "position_type_id",
        "position_type_ids",
        "business_id",
        "sort",
        "order",
        "page",
        "limit",
    ];
    for (const key of Object.keys(req.query)) {
        if (!allowed.includes(key)) {
            return res
                .status(400)
                .json({ error: `Unexpected query parameter: ${key}` });
        }
    }

    const { sort, order } = req.query;
    let position_type_id, position_type_ids, business_id;

    const locResult = parseLatLon(req.query);
    if (locResult.error) return res.status(400).json({ error: locResult.error });
    const { lat, lon } = locResult;
    if (req.query.position_type_ids !== undefined) {
        const ids = req.query.position_type_ids.split(",").map((s) => parseInt(s.trim(), 10));
        if (ids.some(isNaN)) {
            return res.status(400).json({ error: "position_type_ids must be comma-separated numbers" });
        }
        position_type_ids = ids;
    } else if (req.query.position_type_id !== undefined) {
        position_type_id = parseInt(req.query.position_type_id, 10);
        if (isNaN(position_type_id)) {
            return res
                .status(400)
                .json({ error: "position_type_id must be a number" });
        }
    }
    if (req.query.business_id !== undefined) {
        business_id = parseInt(req.query.business_id, 10);
        if (isNaN(business_id)) {
            return res.status(400).json({ error: "business_id must be a number" });
        }
    }

    const hasLocation = lat !== undefined && lon !== undefined;
    const sortField = sort || "start_time";
    const sortOrder = order === "desc" ? "desc" : "asc";

    const allowedSorts = [
        "updatedAt",
        "start_time",
        "salary_min",
        "salary_max",
        "distance",
        "eta",
    ];
    if (sort !== undefined && !allowedSorts.includes(sort)) {
        return res.status(400).json({ error: "Invalid sort field" });
    }
    if (order !== undefined && order !== "asc" && order !== "desc") {
        return res.status(400).json({ error: "order must be asc or desc" });
    }

    if ((sortField === "distance" || sortField === "eta") && !hasLocation) {
        return res.status(400).json({
            error: "lat and lon are required when sorting by distance or eta",
        });
    }

    const now = Date.now();
    const negotiationWindowMs = systemConfig.negotiation_window * 1000;
    const where = {
        status: "open",
        start_time: { gt: new Date(now + negotiationWindowMs) },
    };

    if (position_type_ids !== undefined) {
        where.positionTypeId = { in: position_type_ids };
    } else if (position_type_id !== undefined) {
        where.positionTypeId = position_type_id;
    }
    if (business_id !== undefined) {
        where.businessId = business_id;
    }

    const needsInMemorySort = sortField === "distance" || sortField === "eta";

    let orderBy;
    if (!needsInMemorySort) {
        orderBy = { [sortField]: sortOrder };
    }

    const { skip, limit } = parsePagination(req.query);

    if (needsInMemorySort) {
        const allJobs = await prisma.job.findMany({
            where,
            include: {
                positionType: { select: { id: true, name: true } },
                business: {
                    select: { id: true, business_name: true, lon: true, lat: true },
                },
            },
        });

        const jobsWithDistance = allJobs.map((job) => {
            const distance = haversineDistance(
                lat,
                lon,
                job.business.lat,
                job.business.lon
            );
            const eta = computeEta(distance);
            return { ...job, distance, eta };
        });

        const sortKey = sortField === "distance" ? "distance" : "eta";
        jobsWithDistance.sort((a, b) => {
            return sortOrder === "asc"
                ? a[sortKey] - b[sortKey]
                : b[sortKey] - a[sortKey];
        });

        const total = jobsWithDistance.length;
        const paged = jobsWithDistance.slice(skip, skip + limit);

        return res.status(200).json({
            count: total,
            results: paged.map((job) => ({
                id: job.id,
                status: "open",
                position_type: { id: job.positionType.id, name: job.positionType.name },
                business: {
                    id: job.business.id,
                    business_name: job.business.business_name,
                },
                salary_min: job.salary_min,
                salary_max: job.salary_max,
                start_time: job.start_time,
                end_time: job.end_time,
                updatedAt: job.updatedAt,
                distance: Math.round(job.distance),
                eta: job.eta,
            })),
        });
    }

    const [jobs, total] = await Promise.all([
        prisma.job.findMany({
            where,
            include: {
                positionType: { select: { id: true, name: true } },
                business: {
                    select: { id: true, business_name: true, lon: true, lat: true },
                },
            },
            orderBy,
            skip,
            take: limit,
        }),
        prisma.job.count({ where }),
    ]);

    return res.status(200).json({
        count: total,
        results: jobs.map((job) => {
            const result = {
                id: job.id,
                status: "open",
                position_type: { id: job.positionType.id, name: job.positionType.name },
                business: {
                    id: job.business.id,
                    business_name: job.business.business_name,
                },
                salary_min: job.salary_min,
                salary_max: job.salary_max,
                start_time: job.start_time,
                end_time: job.end_time,
                updatedAt: job.updatedAt,
            };
            if (hasLocation) {
                const distance = haversineDistance(
                    lat,
                    lon,
                    job.business.lat,
                    job.business.lon
                );
                result.distance = Math.round(distance);
                result.eta = computeEta(distance);
            }
            return result;
        }),
    });
});



router.get("/:jobId", requireAuth, async (req, res) => {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
        return res.status(404).json({ error: "Job not found" });
    }

    const isBusiness = req.user.role === "business";
    const isRegular = req.user.role === "regular";

    if (!isBusiness && !isRegular) {
        return res.status(403).json({ error: "Forbidden" });
    }

    if (
        isBusiness &&
        (req.query.lat !== undefined || req.query.lon !== undefined)
    ) {
        return res
            .status(400)
            .json({ error: "Businesses cannot specify lat or lon" });
    }

    let lat, lon;
    if (isRegular) {
        const locResult = parseLatLon(req.query);
        if (locResult.error)
            return res.status(400).json({ error: locResult.error });
        ({ lat, lon } = locResult);
    }

    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
            positionType: { select: { id: true, name: true } },
            business: {
                select: { id: true, business_name: true, lon: true, lat: true },
            },
            worker: { select: { id: true, first_name: true, last_name: true } },
        },
    });
    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }

    const now = Date.now();
    const effectiveStatus = getEffectiveJobStatus(job, now);

    if (isBusiness) {
        if (job.businessId !== req.user.id) {
            return res.status(404).json({ error: "Job not found" });
        }

        return res.status(200).json({
            id: job.id,
            status: effectiveStatus,
            position_type: { id: job.positionType.id, name: job.positionType.name },
            business: {
                id: job.business.id,
                business_name: job.business.business_name,
            },
            worker: job.worker
                ? {
                    id: job.worker.id,
                    first_name: job.worker.first_name,
                    last_name: job.worker.last_name,
                }
                : null,
            note: job.note,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            start_time: job.start_time,
            end_time: job.end_time,
            updatedAt: job.updatedAt,
        });
    }

    const isWorker = job.workerId === req.user.id;
    if (effectiveStatus === "open") {
        const qualification = await prisma.qualification.findUnique({
            where: {
                userId_positionTypeId: {
                    userId: req.user.id,
                    positionTypeId: job.positionTypeId,
                },
            },
        });
        if (!qualification || qualification.status !== "approved") {
            return res.status(403).json({ error: "You do not qualify for this job" });
        }
    } else if (!isWorker) {
        // Allow access if the user has an interest record (expressed interest or was invited)
        const hasInterest = await prisma.interest.findUnique({
            where: { jobId_candidateId: { jobId: job.id, candidateId: req.user.id } },
            select: { id: true },
        });
        if (!hasInterest) {
            return res.status(404).json({ error: "Job not found" });
        }
    }

    const interest = await prisma.interest.findUnique({
        where: { jobId_candidateId: { jobId: job.id, candidateId: req.user.id } },
        select: { candidateInterested: true },
    });

    const result = {
        id: job.id,
        status: effectiveStatus,
        position_type: { id: job.positionType.id, name: job.positionType.name },
        business: {
            id: job.business.id,
            business_name: job.business.business_name,
        },
        worker: job.worker
            ? {
                id: job.worker.id,
                first_name: job.worker.first_name,
                last_name: job.worker.last_name,
            }
            : null,
        note: job.note,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        start_time: job.start_time,
        end_time: job.end_time,
        candidate_interested: interest ? interest.candidateInterested : false,
        updatedAt: job.updatedAt,
    };

    const hasLocation = lat !== undefined && lon !== undefined;
    if (hasLocation) {
        const distance = haversineDistance(
            lat,
            lon,
            job.business.lat,
            job.business.lon
        );
        result.distance = Math.round(distance);
        result.eta = computeEta(distance);
    }

    return res.status(200).json(result);
});

router.patch(
    "/:jobId/interested",
    requireAuth,
    requireRole("regular"),
    async (req, res) => {
        const jobId = parseInt(req.params.jobId, 10);
        if (isNaN(jobId)) {
            return res.status(404).json({ error: "Job not found" });
        }

        const { interested } = req.body;
        if (typeof interested !== "boolean") {
            return res
                .status(400)
                .json({ error: "interested is required and must be a boolean" });
        }

        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        const now = Date.now();
        const effectiveStatus = getEffectiveJobStatus(job, now);
        if (effectiveStatus !== "open") {
            return res.status(409).json({ error: "Job is no longer available" });
        }

        const negotiationWindowMs = systemConfig.negotiation_window * 1000;
        if (job.start_time.getTime() - now < negotiationWindowMs) {
            return res.status(409).json({ error: "Job is no longer available" });
        }

        const qualification = await prisma.qualification.findUnique({
            where: {
                userId_positionTypeId: {
                    userId: req.user.id,
                    positionTypeId: job.positionTypeId,
                },
            },
        });
        if (!qualification || qualification.status !== "approved") {
            return res.status(403).json({ error: "You do not qualify for this job" });
        }

        const activeNegotiation = await prisma.negotiation.findFirst({
            where: { jobId, candidateId: req.user.id, status: "active" },
        });
        if (activeNegotiation) {
            return res
                .status(409)
                .json({ error: "You are currently in a negotiation for this job" });
        }

        const existingInterest = await prisma.interest.findUnique({
            where: { jobId_candidateId: { jobId, candidateId: req.user.id } },
        });

        if (interested) {
            let interest;
            if (existingInterest) {
                interest = await prisma.interest.update({
                    where: { id: existingInterest.id },
                    data: { candidateInterested: true },
                });
            } else {
                interest = await prisma.interest.create({
                    data: {
                        jobId,
                        candidateId: req.user.id,
                        candidateInterested: true,
                    },
                });
            }

            await prisma.regularUser.update({
                where: { id: req.user.id },
                data: { lastActiveAt: new Date() },
            });

            return res.status(200).json({
                id: interest.id,
                job_id: interest.jobId,
                candidate: {
                    id: interest.candidateId,
                    interested: interest.candidateInterested,
                },
                business: {
                    id: job.businessId,
                    interested: interest.businessInterested,
                },
            });
        } else {
            if (!existingInterest || existingInterest.candidateInterested !== true) {
                return res
                    .status(400)
                    .json({ error: "You have not expressed interest in this job" });
            }

            const interest = await prisma.interest.update({
                where: { id: existingInterest.id },
                data: { candidateInterested: false },
            });

            return res.status(200).json({
                id: interest.id,
                job_id: interest.jobId,
                candidate: {
                    id: interest.candidateId,
                    interested: interest.candidateInterested,
                },
                business: {
                    id: job.businessId,
                    interested: interest.businessInterested,
                },
            });
        }
    }
);

router.patch(
    "/:jobId/no-show",
    requireAuth,
    requireRole("business"),
    async (req, res) => {
        const jobId = parseInt(req.params.jobId, 10);
        if (isNaN(jobId)) {
            return res.status(404).json({ error: "Job not found" });
        }

        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }
        if (job.businessId !== req.user.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        if (job.status !== "filled") {
            return res.status(409).json({ error: "Job is not filled" });
        }

        const now = Date.now();
        if (now < job.start_time.getTime()) {
            return res.status(409).json({ error: "Job has not started yet" });
        }
        if (now >= job.end_time.getTime()) {
            return res.status(409).json({ error: "Job is already over" });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const updatedJob = await tx.job.update({
                where: { id: jobId },
                data: { status: "canceled" },
            });

            await tx.regularUser.update({
                where: { id: job.workerId },
                data: { suspended: true },
            });

            return updatedJob;
        });

        return res.status(200).json({
            id: updated.id,
            status: updated.status,
            updatedAt: updated.updatedAt,
        });
    }
);

router.get(
    "/:jobId/candidates",
    requireAuth,
    requireRole("business"),
    async (req, res) => {
        const jobId = parseInt(req.params.jobId, 10);
        if (isNaN(jobId)) return res.status(404).json({ error: "Job not found" });

        const allowed = ["page", "limit"];
        for (const key of Object.keys(req.query)) {
            if (!allowed.includes(key))
                return res
                    .status(400)
                    .json({ error: `Unexpected query parameter: ${key}` });
        }

        const now = Date.now();
        const { skip, limit } = parsePagination(req.query);
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.businessId !== req.user.id) {
            return res.status(404).json({ error: "Job not found" });
        }

        // pull users who are activated, not suspended ,available and have an approved qual
        const candidates = await prisma.regularUser.findMany({
            where: {
                suspended: false,
                available: true,
                account: { activated: true },
                qualifications: {
                    some: { positionTypeId: job.positionTypeId, status: "approved" },
                },
            },
            include: {
                account: { select: { activated: true } },
                qualifications: {
                    where: { positionTypeId: job.positionTypeId, status: "approved" },
                },
                filledJobs: { where: { status: "filled" } },
            },
        });

        const timeoutMs = systemConfig.availability_timeout * 1000;
        const jobStart = new Date(job.start_time).getTime();
        const jobEnd = new Date(job.end_time).getTime();

        const discoverable = candidates.filter((u) => {
            if (now - new Date(u.lastActiveAt).getTime() > timeoutMs) return false;
            // check for schedule conflicts with any filled jobs
            for (const fj of u.filledJobs) {
                const fjEnd = new Date(fj.end_time).getTime();
                if (now >= fjEnd) continue;
                const fjStart = new Date(fj.start_time).getTime();
                if (!(fjEnd <= jobStart || fjStart >= jobEnd)) return false;
            }
            return true;
        });

        // check which ones have already been invited??
        const interests = await prisma.interest.findMany({
            where: { jobId, candidateId: { in: discoverable.map((u) => u.id) } },
        });
        const interestMap = new Map(interests.map((i) => [i.candidateId, i]));

        const paged = discoverable.slice(skip, skip + limit);
        return res.status(200).json({
            count: discoverable.length,
            results: paged.map((u) => ({
                id: u.id,
                first_name: u.first_name,
                last_name: u.last_name,
                invited: interestMap.get(u.id)?.businessInterested === true,
            })),
        });
    }
);

router.get(
    "/:jobId/candidates/:userId",
    requireAuth,
    requireRole("business"),
    async (req, res) => {
        const jobId = parseInt(req.params.jobId, 10);
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(jobId) || isNaN(userId))
            return res.status(404).json({ error: "Not found" });

        const now = Date.now();

        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: { positionType: { select: { id: true, name: true, description: true } } },
        });
        if (!job || job.businessId !== req.user.id) {
            return res.status(404).json({ error: "Job not found" });
        }

        const user = await prisma.regularUser.findUnique({
            where: { id: userId },
            include: {
                account: { select: { email: true, activated: true } },
                qualifications: {
                    where: { status: "approved" },
                    include: { positionType: { select: { id: true, name: true } } },
                },
                filledJobs: { where: { status: "filled" } },
            },
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        // if this candidate filled
        const jobFilledByUser = job.status === "filled" && job.workerId === userId;
        const filledAndNotEnded =
            jobFilledByUser && now < new Date(job.end_time).getTime();

        // discoverability check uses only the qualification matching this job's position type
        const jobQual = user.qualifications.filter((q) => q.positionTypeId === job.positionTypeId);
        if (!filledAndNotEnded) {
            if (
                !isDiscoverable(
                    user,
                    user.account,
                    jobQual,
                    user.filledJobs,
                    job,
                    now
                )
            ) {
                return res.status(403).json({ error: "User is not discoverable" });
            }
        }
        const userObj = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar: user.avatar,
            resume: user.resume,
            biography: user.biography,
            qualifications: user.qualifications.map((q) => ({
                id: q.id,
                position_type: { id: q.positionType.id, name: q.positionType.name },
                document: q.document,
                note: q.note,
                updatedAt: q.updatedAt,
            })),
        };

        // expose contact info if they filled this job
        if (filledAndNotEnded) {
            userObj.email = user.account.email;
            userObj.phone_number = user.phone_number;
        }
        return res.status(200).json({
            user: userObj,
            job: {
                id: job.id,
                status: getEffectiveJobStatus(job, now),
                position_type: { id: job.positionType.id, name: job.positionType.name, description: job.positionType.description },
                start_time: job.start_time,
                end_time: job.end_time,
            },
        });
    }
);

router.patch(
    "/:jobId/candidates/:userId/interested",
    requireAuth,
    requireRole("business"),
    async (req, res) => {
        const jobId = parseInt(req.params.jobId, 10);
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(jobId) || isNaN(userId))
            return res.status(404).json({ error: "Not found" });
        //double check interest
        const allowed = ["interested"];
        for (const key of Object.keys(req.body)) {
            if (!allowed.includes(key))
                return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
        const { interested } = req.body;
        if (typeof interested !== "boolean") {
            return res.status(400).json({ error: "interested must be a boolean" });
        }
        const now = Date.now();
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.businessId !== req.user.id) {
            return res.status(404).json({ error: "Job not found" });
        }
        const effectiveStatus = getEffectiveJobStatus(job, now);
        if (effectiveStatus !== "open") {
            return res.status(409).json({ error: "Job is not open" });
        }
        const user = await prisma.regularUser.findUnique({
            where: { id: userId },
            include: {
                account: { select: { activated: true } },
                qualifications: {
                    where: { positionTypeId: job.positionTypeId, status: "approved" },
                },
            },
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        let interest = await prisma.interest.findUnique({
            where: { jobId_candidateId: { jobId, candidateId: userId } },
        });

        // discoverability only required when inviting a candidate who hasn't already expressed interest
        if (interested && !(interest && interest.candidateInterested)) {
            const timeoutMs = systemConfig.availability_timeout * 1000;
            const isActive = now - new Date(user.lastActiveAt).getTime() <= timeoutMs;
            if (
                !user.account.activated ||
                user.suspended ||
                !user.available ||
                !isActive ||
                user.qualifications.length === 0
            ) {
                return res.status(403).json({ error: "User is not discoverable" });
            }
        }
        if (!interested) {
            if (!interest || interest.businessInterested !== true) {
                return res
                    .status(400)
                    .json({ error: "No existing invitation to withdraw" });
            }
            interest = await prisma.interest.update({
                where: { id: interest.id },
                data: { businessInterested: false },
            });
        } else {
            if (!interest) {
                interest = await prisma.interest.create({
                    data: { jobId, candidateId: userId, businessInterested: true },
                });
            } else {
                interest = await prisma.interest.update({
                    where: { id: interest.id },
                    data: { businessInterested: true },
                });
            }
        }

        return res.status(200).json({
            id: interest.id,
            job_id: jobId,
            candidate: { id: userId, interested: interest.candidateInterested },
            business: { id: req.user.id, interested: interest.businessInterested },
        });
    }
);

router.get(
    "/:jobId/interests",
    requireAuth,
    requireRole("business"),
    async (req, res) => {
        const jobId = parseInt(req.params.jobId, 10);
        if (isNaN(jobId)) return res.status(404).json({ error: "Job not found" });

        const allowedQ = ["page", "limit"];
        for (const key of Object.keys(req.query)) {
            if (!allowedQ.includes(key))
                return res
                    .status(400)
                    .json({ error: `Unexpected query parameter: ${key}` });
        }

        const { skip, limit } = parsePagination(req.query);
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.businessId !== req.user.id) {
            return res.status(404).json({ error: "Job not found" });
        }
        const [total, interests] = await Promise.all([
            prisma.interest.count({ where: { jobId, candidateInterested: true } }),
            prisma.interest.findMany({
                where: { jobId, candidateInterested: true },
                include: {
                    candidate: {
                        select: { id: true, first_name: true, last_name: true },
                    },
                },
                skip,
                take: limit,
            }),
        ]);
        return res.status(200).json({
            count: total,
            results: interests.map((i) => ({
                interest_id: i.id,
                mutual: !!(i.candidateInterested && i.businessInterested),
                user: i.candidate,
            })),
        });
    }
);

router.all("/:jobId/candidates/:userId/interested", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" })
);
router.all("/:jobId/candidates/:userId", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" })
);
router.all("/:jobId/candidates", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" })
);
router.all("/:jobId/interests", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" })
);
router.all("/:jobId/no-show", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" })
);
router.all("/:jobId", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" })
);
router.all("/", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" })
);

module.exports = router;
