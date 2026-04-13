"use strict";

// System configuration, stored in memory, not persisted to DB
// for "/system/reset-cooldown" instruction's Note

// "
// Note: any system configuration related endpoints do not need to be persisted, i.e., they can simply be global variables.

// ""
const systemConfig = {
  reset_cooldown: 60,
  negotiation_window: 900,
  job_start_window: 168,
  availability_timeout: 300,
};

module.exports = systemConfig;
