'use strict';

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { parsePagination } = require("../utils/helpers");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
    const allowed = ["keyword", "status", "page", "limit"];
    for (const key of Object.keys(req.query)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected query parameter: ${key}` });
        }
    }

    const { keyword, status } = req.query;
    const VALID_STATUSES = ["created", "submitted", "approved", "rejected", "revised"];
    const where = {};

    if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
        }
        where.status = status;
    }

    if (keyword !== undefined) {
        if (typeof keyword !== "string") {
            return res.status(400).json({ error: "keyword must be a string" });
        }
        const search = keyword.trim();
        where.user = {
            OR: [
                { first_name: { contains: search } },
                { last_name: { contains: search } },
                { phone_number: { contains: search } },
                { account: { email: { contains: search } } },
            ],
        };
    }

    const { skip, limit } = parsePagination(req.query);
    const [qualifications, total] = await Promise.all([
        prisma.qualification.findMany({
            where,
            include: {
                user: { select: { id: true, first_name: true, last_name: true } },
                positionType: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.qualification.count({ where }),
    ]);

    return res.status(200).json({
        count: total,
        results: qualifications.map((q) => ({
            id: q.id,
            status: q.status,
            user: {
                id: q.user.id,
                first_name: q.user.first_name,
                last_name: q.user.last_name,
            },
            position_type: {
                id: q.positionType.id,
                name: q.positionType.name,
            },
            updatedAt: q.updatedAt,
        })),
    });
});

router.post("/", requireAuth, requireRole("regular"), async (req, res) => {
    const allowed = ["position_type_id", "note"];
    for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
    }

    const { position_type_id, note } = req.body;

    if (position_type_id === undefined || typeof position_type_id !== "number" || !Number.isInteger(position_type_id)) {
        return res.status(400).json({ error: "position_type_id is required and must be an integer" });
    }
    if (note !== undefined && typeof note !== "string") {
        return res.status(400).json({ error: "note must be a string" });
    }

    const positionType = await prisma.positionType.findUnique({
        where: { id: position_type_id },
    });
    if (!positionType) {
        return res.status(404).json({ error: "Position type not found" });
    }
    if (positionType.hidden) {
        return res.status(400).json({ error: "Position type is hidden" });
    }

    const existing = await prisma.qualification.findUnique({
        where: { userId_positionTypeId: { userId: req.user.id, positionTypeId: position_type_id } },
    });
    if (existing) {
        return res.status(409).json({ error: "Qualification already exists for this position type" });
    }

    const qualification = await prisma.qualification.create({
        data: {
            userId: req.user.id,
            positionTypeId: position_type_id,
            note: note || "",
        },
        include: {
            user: { select: { id: true, first_name: true, last_name: true } },
            positionType: { select: { id: true, name: true } },
        },
    });

    return res.status(201).json({
        id: qualification.id,
        status: qualification.status,
        note: qualification.note,
        document: qualification.document,
        user: {
            id: qualification.user.id,
            first_name: qualification.user.first_name,
            last_name: qualification.user.last_name,
        },
        position_type: {
            id: qualification.positionType.id,
            name: qualification.positionType.name,
        },
        updatedAt: qualification.updatedAt,
    });
});

router.get("/:qualificationId", requireAuth, async (req, res) => {
    const qualificationId = parseInt(req.params.qualificationId, 10);
    if (isNaN(qualificationId)) {
        return res.status(404).json({ error: "Qualification not found" });
    }

    const qualification = await prisma.qualification.findUnique({
        where: { id: qualificationId },
        include: {
            user: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    phone_number: true,
                    postal_address: true,
                    birthday: true,
                    suspended: true,
                    avatar: true,
                    resume: true,
                    biography: true,
                    account: {
                        select: { email: true, role: true, activated: true, createdAt: true },
                    },
                },
            },
            positionType: { select: { id: true, name: true, description: true } },
        },
    });
    if (!qualification) {
        return res.status(404).json({ error: "Qualification not found" });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.role === "regular" && req.user.id === qualification.userId;
    const isBusiness = req.user.role === "business";

    if (isOwner || isAdmin) {
        const user = {
            id: qualification.user.id,
            first_name: qualification.user.first_name,
            last_name: qualification.user.last_name,
            role: qualification.user.account.role,
            avatar: qualification.user.avatar,
            resume: qualification.user.resume,
            biography: qualification.user.biography,
            email: qualification.user.account.email,
            phone_number: qualification.user.phone_number,
            postal_address: qualification.user.postal_address,
            birthday: qualification.user.birthday,
            activated: qualification.user.account.activated,
            suspended: qualification.user.suspended,
            createdAt: qualification.user.account.createdAt,
        };

        return res.status(200).json({
            id: qualification.id,
            status: qualification.status,
            note: qualification.note,
            document: qualification.document,
            user,
            position_type: {
                id: qualification.positionType.id,
                name: qualification.positionType.name,
                description: qualification.positionType.description,
            },
            updatedAt: qualification.updatedAt,
        });
    }

    if (isBusiness) {
        if (qualification.status !== "approved") {
            return res.status(403).json({ error: "Forbidden" });
        }

        const matchingInterest = await prisma.interest.findFirst({
            where: {
                candidateId: qualification.userId,
                job: {
                    businessId: req.user.id,
                    status: "open",
                    positionTypeId: qualification.positionTypeId,
                },
            },
        });
        if (!matchingInterest) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const user = {
            id: qualification.user.id,
            first_name: qualification.user.first_name,
            last_name: qualification.user.last_name,
            role: qualification.user.account.role,
            avatar: qualification.user.avatar,
            resume: qualification.user.resume,
            biography: qualification.user.biography,
        };

        return res.status(200).json({
            id: qualification.id,
            note: qualification.note,
            document: qualification.document,
            user,
            position_type: {
                id: qualification.positionType.id,
                name: qualification.positionType.name,
                description: qualification.positionType.description,
            },
            updatedAt: qualification.updatedAt,
        });
    }

    return res.status(404).json({ error: "Qualification not found" });
});

router.patch("/:qualificationId", requireAuth, async (req, res) => {
    const qualificationId = parseInt(req.params.qualificationId, 10);
    if (isNaN(qualificationId)) {
        return res.status(404).json({ error: "Qualification not found" });
    }

    const qualification = await prisma.qualification.findUnique({
        where: { id: qualificationId },
        include: {
            user: { select: { id: true, first_name: true, last_name: true } },
            positionType: { select: { id: true, name: true } },
        },
    });
    if (!qualification) {
        return res.status(404).json({ error: "Qualification not found" });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.role === "regular" && req.user.id === qualification.userId;

    if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const allowed = ["status", "note"];
    for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
    }

    const { status, note } = req.body;
    const updates = {};

    if (status !== undefined) {
        if (typeof status !== "string") {
            return res.status(400).json({ error: "status must be a string" });
        }

        const adminStatuses = ["approved", "rejected"];
        const regularStatuses = ["submitted", "revised"];

        if (isAdmin && !adminStatuses.includes(status)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        if (isOwner && !regularStatuses.includes(status)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const validTransitions = isAdmin
            ? {
                created:   ["approved", "rejected"],
                submitted: ["approved", "rejected"],
                approved:  ["rejected"],
                rejected:  ["approved"],
                revised:   ["approved", "rejected"],
            }
            : {
                created:   ["submitted"],
                submitted: [],
                approved:  ["revised"],
                rejected:  ["revised"],
                revised:   [],
            };
        const allowedNext = validTransitions[qualification.status];
        if (!allowedNext || !allowedNext.includes(status)) {
            return res.status(400).json({ error: `Cannot transition from ${qualification.status} to ${status}` });
        }

        updates.status = status;
    }

    if (note !== undefined) {
        if (typeof note !== "string") {
            return res.status(400).json({ error: "note must be a string" });
        }
        updates.note = note;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
    }

    const updated = await prisma.qualification.update({
        where: { id: qualificationId },
        data: updates,
        include: {
            user: { select: { id: true, first_name: true, last_name: true } },
            positionType: { select: { id: true, name: true } },
        },
    });

    return res.status(200).json({
        id: updated.id,
        status: updated.status,
        note: updated.note,
        document: updated.document,
        user: {
            id: updated.user.id,
            first_name: updated.user.first_name,
            last_name: updated.user.last_name,
        },
        position_type: {
            id: updated.positionType.id,
            name: updated.positionType.name,
        },
        updatedAt: updated.updatedAt,
    });
});

router.all("/", (_req, res) => res.status(405).json({ error: "Method not allowed" }));
router.all("/:qualificationId", (_req, res) => res.status(405).json({ error: "Method not allowed" }));

module.exports = router;
