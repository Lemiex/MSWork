"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const businessesRouter = require("./routes/businesses");
const businessJobsRouter = require("./routes/businessJobs");
const jobsRouter = require("./routes/jobs");
const positionTypesRouter = require("./routes/positionTypes");
const qualificationsRouter = require("./routes/qualifications");
const systemRouter = require("./routes/system");
const negotiationsRouter = require("./routes/negotiations");
const uploadsRouter = require("./routes/uploads");

function create_app() {
  const app = express();
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json());

  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "../uploads");
  app.use("/uploads", express.static(uploadsDir));
  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/businesses", businessesRouter);
  app.use("/businesses/me/jobs", businessJobsRouter);
  app.use("/jobs", jobsRouter);
  app.use("/position-types", positionTypesRouter);
  app.use("/qualifications", qualificationsRouter);
  app.use("/system", systemRouter);
  app.use("/negotiations", negotiationsRouter);
  app.use("/", uploadsRouter);

  return app;
}

module.exports = { create_app };
