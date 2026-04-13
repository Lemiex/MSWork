"use strict";

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./middleware/auth");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
let io;

// In-memory chat history keyed by negotiation id
const chatHistory = new Map();

function attach_sockets(server) {
  io = new Server(server, { cors: { origin: "*" } });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not authenticated"));
    try {
      const user = jwt.verify(token, JWT_SECRET);
      socket.userId = user.id;
      socket.userRole = user.role;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    // Join personal account room
    socket.join(`account:${socket.userId}`);

    // Auto-join ALL active negotiation rooms so messages are received across all ongoing negotiations
    const idField = socket.userRole === "regular" ? "candidateId" : "businessId";
    const activeNegs = await prisma.negotiation.findMany({
      where: {
        [idField]: socket.userId,
        status: "active",
        expiresAt: { gt: new Date() },
      },
    });

    for (const neg of activeNegs) {
      socket.join(`negotiation:${neg.id}`);
      const history = chatHistory.get(neg.id) || [];
      if (history.length) {
        // Include negotiation_id so the client can route to the right chat window
        socket.emit("negotiation:history", { negotiation_id: neg.id, messages: history });
      }
    }

    // negotiation:message — send a chat message in a specific active negotiation
    socket.on("negotiation:message", async (data) => {
      const { negotiation_id, text } = data || {};
      const now = Date.now();

      const neg = await prisma.negotiation.findUnique({ where: { id: negotiation_id } });
      if (!neg || neg.status !== "active" || new Date(neg.expiresAt).getTime() <= now) {
        return socket.emit("negotiation:error", {
          error: "Negotiation not found or inactive",
          message: "No active negotiation with that id",
        });
      }

      const isCandidate = neg.candidateId === socket.userId;
      const isBusiness = neg.businessId === socket.userId;
      if (!isCandidate && !isBusiness) {
        return socket.emit("negotiation:error", {
          error: "Not part of this negotiation",
          message: "You aren't a party in this negotiation",
        });
      }

      const msg = {
        negotiation_id,
        sender: { role: socket.userRole, id: socket.userId },
        text,
        createdAt: new Date().toISOString(),
      };
      if (!chatHistory.has(negotiation_id)) chatHistory.set(negotiation_id, []);
      chatHistory.get(negotiation_id).push(msg);
      io.to(`negotiation:${negotiation_id}`).emit("negotiation:message", msg);
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { attach_sockets, getIO };
