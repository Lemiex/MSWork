'use strict';

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient } = require("@prisma/client");
const { isValidEmail, isValidPassword, parsePagination, validateLocation } = require("../utils/helpers");
const { JWT_SECRET, requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        req.user = null;
        return next();
    }
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    try {
        req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

router.post("/", async (req, res) => {
    const allowed = [
        "email",
        "password",
        "business_name",
        "owner_name",
        "phone_number",
        "postal_address",
        "location",
    ];
    for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
    }

    const {
        email,
        password,
        business_name,
        owner_name,
        phone_number,
        postal_address,
        location,
    } = req.body;

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ error: "Invalid password format" });
    }
    if (!business_name || typeof business_name !== "string") {
        return res.status(400).json({ error: "business_name is required" });
    }
    if (!owner_name || typeof owner_name !== "string") {
        return res.status(400).json({ error: "owner_name is required" });
    }
    if (!phone_number || typeof phone_number !== "string") {
        return res.status(400).json({ error: "phone_number is required" });
    }
    if (!postal_address || typeof postal_address !== "string") {
        return res.status(400).json({ error: "postal_address is required" });
    }
    const locationErr = validateLocation(location);
    if (locationErr) return res.status(400).json({ error: locationErr });

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
                role: "business",
                activated: false,
                resetToken,
                resetTokenExpiry: expiresAt,
                resetTokenUsed: false,
            },
        });

        const business = await tx.business.create({
            data: {
                id: account.id,
                business_name,
                owner_name,
                phone_number,
                postal_address,
                lon: location.lon,
                lat: location.lat,
            },
        });

        return { account, business };
    });

    return res.status(201).json({
        id: result.account.id,
        business_name: result.business.business_name,
        owner_name: result.business.owner_name,
        email: result.account.email,
        activated: result.account.activated,
        verified: result.business.verified,
        role: result.account.role,
        phone_number: result.business.phone_number,
        postal_address: result.business.postal_address,
        location: { lon: result.business.lon, lat: result.business.lat },
        createdAt: result.account.createdAt,
        resetToken,
        expiresAt: expiresAt.toISOString(),
    });
});

router.get("/", optionalAuth, async (req, res) => {
    const allowed = ["keyword", "sort", "order", "page", "limit", "activated", "verified"];
    for (const key of Object.keys(req.query)) {
        if (!allowed.includes(key)) {
            return res
                .status(400)
                .json({ error: `Unexpected query parameter: ${key}` });
        }
    }

    const isAdmin = req.user?.role === "admin";
    const hasAdminOnlyParam = req.query.activated !== undefined || req.query.verified !== undefined;
    if (!isAdmin && hasAdminOnlyParam) {
        return res.status(400).json({ error: "Admin-only query parameters require admin access" });
    }

    const { keyword, sort, order, activated, verified } = req.query;
    const where = {};

    if (keyword !== undefined) {
        if (typeof keyword !== "string") {
            return res.status(400).json({ error: "keyword must be a string" });
        }
        const search = keyword.trim();
        const or = [
            { business_name: { contains: search } },
            { postal_address: { contains: search } },
            { phone_number: { contains: search } },
            { account: { email: { contains: search } } },
        ];
        if (isAdmin) {
            or.push({ owner_name: { contains: search } });
        }
        where.OR = or;
    }

    if (isAdmin && activated !== undefined) {
        if (activated !== "true" && activated !== "false") {
            return res.status(400).json({ error: "activated must be true or false" });
        }
        where.account = {
            ...(where.account || {}),
            activated: activated === "true",
        };
    }

    if (isAdmin && verified !== undefined) {
        if (verified !== "true" && verified !== "false") {
            return res.status(400).json({ error: "verified must be true or false" });
        }
        where.verified = verified === "true";
    }

    let orderBy;
    if (sort !== undefined) {
        const direction = order === "desc" ? "desc" : order === undefined || order === "asc" ? "asc" : null;
        if (!direction) {
            return res.status(400).json({ error: "order must be asc or desc" });
        }

        const allowedSort = isAdmin
            ? ["business_name", "email", "owner_name"]
            : ["business_name", "email"];
        if (!allowedSort.includes(sort)) {
            return res.status(400).json({ error: "Invalid sort field" });
        }

        if (sort === "email") {
            orderBy = { account: { email: direction } };
        } else {
            orderBy = { [sort]: direction };
        }
    }

    const { skip, limit } = parsePagination(req.query);
    const businesses = await prisma.business.findMany({
        where,
        include: {
            account: {
                select: {
                    email: true,
                    role: true,
                    activated: true,
                },
            },
        },
        orderBy,
        skip,
        take: limit,
    });
    const total = await prisma.business.count({ where });

    return res.status(200).json({
        count: total,
        results: businesses.map((business) => {
            const result = {
                id: business.id,
                business_name: business.business_name,
                email: business.account.email,
                role: business.account.role,
                phone_number: business.phone_number,
                postal_address: business.postal_address,
            };

            if (isAdmin) {
                result.owner_name = business.owner_name;
                result.verified = business.verified;
                result.activated = business.account.activated;
            }

            return result;
        }),
    });
});

router.all("/", (_req, res) => res.status(405).json({ error: "Method not allowed" }));

router.get("/me", requireAuth, requireRole("business"), async (req, res) => {
    const business = await prisma.business.findUnique({
        where: { id: req.user.id },
        include: { account: { select: { email: true, role: true, activated: true, createdAt: true } } },
    });
    if (!business) {
        return res.status(404).json({ error: "Business not found" });
    }
    return res.status(200).json({
        id: business.id,
        email: business.account.email,
        activated: business.account.activated,
        role: business.account.role,
        business_name: business.business_name,
        owner_name: business.owner_name,
        phone_number: business.phone_number,
        postal_address: business.postal_address,
        location: { lon: business.lon, lat: business.lat },
        verified: business.verified,
        createdAt: business.account.createdAt,
        avatar: business.avatar,
        biography: business.biography,
    });
});


router.patch("/me", requireAuth, requireRole("business"), async (req, res) => {
    const allowed = ["business_name", "owner_name", "phone_number", "postal_address", "location", "avatar", "biography"];
    for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
    }

    const { business_name, owner_name, phone_number, postal_address, location, avatar, biography } = req.body;

    if (business_name !== undefined && (typeof business_name !== "string" || !business_name)) {
        return res.status(400).json({ error: "business_name must be a non-empty string" });
    }
    if (owner_name !== undefined && (typeof owner_name !== "string" || !owner_name)) {
        return res.status(400).json({ error: "owner_name must be a non-empty string" });
    }
    if (phone_number !== undefined && (typeof phone_number !== "string" || !phone_number)) {
        return res.status(400).json({ error: "phone_number must be a non-empty string" });
    }
    if (postal_address !== undefined && (typeof postal_address !== "string" || !postal_address)) {
        return res.status(400).json({ error: "postal_address must be a non-empty string" });
    }
    if (location !== undefined) {
        const locationErr = validateLocation(location);
        if (locationErr) return res.status(400).json({ error: locationErr });
    }
    if (avatar !== undefined && avatar !== null && typeof avatar !== "string") {
        return res.status(400).json({ error: "avatar must be a string" });
    }
    if (biography !== undefined && biography !== null && typeof biography !== "string") {
        return res.status(400).json({ error: "biography must be a string" });
    }

    const updates = {};
    if (business_name !== undefined) updates.business_name = business_name;
    if (owner_name !== undefined) updates.owner_name = owner_name;
    if (phone_number !== undefined) updates.phone_number = phone_number;
    if (postal_address !== undefined) updates.postal_address = postal_address;
    if (location !== undefined) { updates.lon = location.lon; updates.lat = location.lat; }
    if (avatar !== undefined) updates.avatar = avatar;
    if (biography !== undefined) updates.biography = biography;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
    }

    const existing = await prisma.business.findUnique({
        where: { id: req.user.id },
        select: { id: true },
    });
    if (!existing) {
        return res.status(404).json({ error: "Business not found" });
    }

    const updated = await prisma.business.update({
        where: { id: req.user.id },
        data: updates,
    });

    const response = { id: updated.id };
    if (business_name !== undefined) response.business_name = updated.business_name;
    if (owner_name !== undefined) response.owner_name = updated.owner_name;
    if (phone_number !== undefined) response.phone_number = updated.phone_number;
    if (postal_address !== undefined) response.postal_address = updated.postal_address;
    if (location !== undefined) response.location = { lon: updated.lon, lat: updated.lat };
    if (avatar !== undefined) response.avatar = updated.avatar;
    if (biography !== undefined) response.biography = updated.biography;
    return res.status(200).json(response);
});


router.patch("/:businessId/verified", requireAuth, requireRole("admin"), async (req, res) => {
    const businessId = parseInt(req.params.businessId, 10);
    if (isNaN(businessId)) {
        return res.status(404).json({ error: "Business not found" });
    }

    const allowed = ["verified"];
    for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) {
            return res.status(400).json({ error: `Unexpected field: ${key}` });
        }
    }

    const { verified } = req.body;
    if (typeof verified !== "boolean") {
        return res.status(400).json({ error: "verified must be a boolean" });
    }

    const business = await prisma.business.findUnique({
        where: { id: businessId },
    });
    if (!business) {
        return res.status(404).json({ error: "Business not found" });
    }

    const updated = await prisma.business.update({
        where: { id: businessId },
        data: { verified },
        include: { account: { select: { email: true, role: true, activated: true } } },
    });

    return res.status(200).json({
        id: updated.id,
        business_name: updated.business_name,
        owner_name: updated.owner_name,
        email: updated.account.email,
        activated: updated.account.activated,
        verified: updated.verified,
        role: updated.account.role,
        phone_number: updated.phone_number,
        postal_address: updated.postal_address,
    });
});

router.get("/:businessId", optionalAuth, async (req, res) => {
    const businessId = parseInt(req.params.businessId, 10);
    if (isNaN(businessId)) {
        return res.status(404).json({ error: "Business not found" });
    }

    const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: { account: { select: { email: true, role: true, activated: true, createdAt: true } } },
    });
    if (!business) {
        return res.status(404).json({ error: "Business not found" });
    }

    const result = {
        id: business.id,
        business_name: business.business_name,
        email: business.account.email,
        role: business.account.role,
        phone_number: business.phone_number,
        postal_address: business.postal_address,
        location: { lon: business.lon, lat: business.lat },
        avatar: business.avatar,
        biography: business.biography,
    };

    if (req.user?.role === "admin") {
        result.owner_name = business.owner_name;
        result.activated = business.account.activated;
        result.verified = business.verified;
        result.createdAt = business.account.createdAt;
    }

    return res.status(200).json(result);
});



router.all("/me", (_req, res) => 
    res.status(405).json({ error: "Method not allowed" }));
router.all("/:businessId/verified", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" }));
router.all("/:businessId", (_req, res) =>
    res.status(405).json({ error: "Method not allowed" }));

module.exports = router;
