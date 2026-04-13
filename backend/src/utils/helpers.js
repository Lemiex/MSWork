"use strict";

const systemConfig = require("./systemConfig");

// password validation
function isValidPassword(password) {
  if (typeof password !== "string") return false;
  if (password.length < 8 || password.length > 20) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

//email validation
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// BD validation "YYYY-MM-DD"
function isValidBirthday(birthday) {
  if (typeof birthday !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const d = new Date(birthday);
  return !isNaN(d.getTime());
}

// Haversine distance in km
// R = 6371.2km/spec
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371.2;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km?
}

function computeEta(distanceKm) {
  return Math.round((distanceKm / 30) * 60);
}

// Get effective job status at request time
// "open" stored,"expired"
// "filled" stored,  "completed"
function getEffectiveJobStatus(job, now) {
  if (job.status === "open") {
    const negotiationWindowMs = systemConfig.negotiation_window * 1000;
    if (now >= new Date(job.start_time).getTime() - negotiationWindowMs) {
      return "expired";
    }
    return "open";
  }
  if (job.status === "filled") {
    if (now >= new Date(job.end_time).getTime()) {
      return "completed";
    }
    return "filled";
  }
  return job.status; // 'canceled'
}

// Checks if regular user can be discovered for sspecific job at right now
// IF
//   1. account activated
//   2. not suspended
//   3. has approved qualification for job's position type
//   4. available flag is true
//   5. lastActiveAt within availability_timeout
//   6. not committed to a conflicting filled job
function isDiscoverable(user, account, qualifications, filledJobs, job, now) {
  if (!account.activated) return false;
  if (user.suspended) return false;
  if (!user.available) return false;

  const timeoutMs = systemConfig.availability_timeout * 1000;
  if (now - new Date(user.lastActiveAt).getTime() > timeoutMs) return false;

  const hasQual = qualifications.some(
    (q) => q.positionTypeId === job.positionTypeId && q.status === "approved"
  );
  if (!hasQual) return false;
  const jobStart = new Date(job.start_time).getTime();
  const jobEnd = new Date(job.end_time).getTime();
  for (const fj of filledJobs) {
    if (fj.status !== "filled") continue;
    const fjEnd = new Date(fj.end_time).getTime();
    if (now >= fjEnd) continue;
    const fjStart = new Date(fj.start_time).getTime();
    if (!(fjEnd <= jobStart || fjStart >= jobEnd)) return false;
  }
  return true;
}

// A 'where" clause for job status filter
function buildJobStatusWhere(statuses, now) {
  const negotiationWindowMs = systemConfig.negotiation_window * 1000;
  const expiryBoundary = new Date(now + negotiationWindowMs);
  const conditions = [];
  for (const s of statuses) {
    if (s === "open") {
      conditions.push({ status: "open", start_time: { gt: expiryBoundary } });
    } else if (s === "expired") {
      conditions.push({ status: "open", start_time: { lte: expiryBoundary } });
    } else if (s === "filled") {
      conditions.push({ status: "filled", end_time: { gt: new Date(now) } });
    } else if (s === "completed") {
      conditions.push({ status: "filled", end_time: { lte: new Date(now) } });
    } else if (s === "canceled") {
      conditions.push({ status: "canceled" });
    }
  }
  return conditions.length > 0 ? { OR: conditions } : { id: -1 }; // no match
}

// Parse and validate pagination
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.max(1, parseInt(query.limit) || 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseDate(value) {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parseLatLon(query) {
  let lat, lon;
  if (query.lat !== undefined) {
    lat = parseFloat(query.lat);
    if (!Number.isFinite(lat)) return { error: "lat must be a number" };
  }
  if (query.lon !== undefined) {
    lon = parseFloat(query.lon);
    if (!Number.isFinite(lon)) return { error: "lon must be a number" };
  }
  if ((lat !== undefined) !== (lon !== undefined)) {
    return { error: "Both lat and lon must be provided together" };
  }
  return { lat, lon };
}

function validateLocation(location) {
  if (!location || typeof location !== "object") {
    return "location is required and must be an object";
  }
  if (typeof location.lon !== "number" || !Number.isFinite(location.lon)) {
    return "location.lon is required and must be a number";
  }
  if (typeof location.lat !== "number" || !Number.isFinite(location.lat)) {
    return "location.lat is required and must be a number";
  }
  if (location.lon < -180 || location.lon > 180) {
    return "location.lon must be between -180 and 180";
  }
  if (location.lat < -90 || location.lat > 90) {
    return "location.lat must be between -90 and 90";
  }
  return null;
}

// use them :)
module.exports = {
  isValidPassword,
  isValidEmail,
  isValidBirthday,
  haversineDistance,
  computeEta,
  getEffectiveJobStatus,
  isDiscoverable,
  buildJobStatusWhere,
  parsePagination,
  parseDate,
  parseLatLon,
  validateLocation,
};
