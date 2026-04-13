/*
 * Seed script — populates the database with realistic demo data.
 * All account passwords are "123123" (hashed with bcrypt, bypassing validation).
 */
"use strict";

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */
const HASH = bcrypt.hashSync("123123", 1); // pre-compute once
const hour = 3600 * 1000;
const day = 24 * hour;
const now = Date.now();

const firstNames = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Ethan",
  "Fiona",
  "George",
  "Hannah",
  "Isaac",
  "Julia",
  "Kevin",
  "Liam",
  "Mia",
  "Noah",
  "Olivia",
  "Patrick",
  "Quinn",
  "Rachel",
  "Sam",
  "Tina",
  "Uma",
  "Victor",
];
const lastNames = [
  "Smith",
  "Jones",
  "Lee",
  "Brown",
  "Wilson",
  "Taylor",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Martin",
  "Garcia",
  "Clark",
  "Lewis",
  "Walker",
  "Hall",
  "Allen",
  "Young",
  "King",
  "Wright",
  "Lopez",
];
const streets = [
  "King St W",
  "Queen St W",
  "Bloor St",
  "Dundas St",
  "College St",
  "Spadina Ave",
  "Bay St",
  "Yonge St",
  "Bathurst St",
  "University Ave",
];

function addr(i) {
  return `${10 + i * 5} ${streets[i % streets.length]}, Toronto`;
}
function phone(i) {
  return `416-555-${String(1000 + i).slice(-4)}`;
}
function bday(i) {
  const y = 1985 + (i % 15);
  const m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}-15`;
}

/* ------------------------------------------------------------------ */
/*  main                                                               */
/* ------------------------------------------------------------------ */
async function main() {
  /* ---------- Clear existing data (safe re-seed) ---------- */
  await prisma.negotiation.deleteMany();
  await prisma.interest.deleteMany();
  await prisma.qualification.deleteMany();
  await prisma.job.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.regularUser.deleteMany();
  await prisma.business.deleteMany();
  await prisma.account.deleteMany();
  await prisma.positionType.deleteMany();

  /* ---------- Position Types (12) ---------- */
  const ptData = [
    {
      name: "Waiter",
      description: "Serving food and beverages to customers",
      hidden: false,
    },
    {
      name: "Bartender",
      description: "Preparing and serving drinks at a bar",
      hidden: false,
    },
    {
      name: "Cook",
      description: "Preparing meals in a kitchen",
      hidden: false,
    },
    {
      name: "Cashier",
      description: "Handling payments and customer transactions",
      hidden: false,
    },
    {
      name: "Cleaner",
      description: "Maintaining cleanliness of premises",
      hidden: false,
    },
    {
      name: "Barista",
      description: "Brewing coffee and espresso beverages",
      hidden: false,
    },
    {
      name: "Dishwasher",
      description: "Cleaning dishes, utensils, and kitchen equipment",
      hidden: false,
    },
    {
      name: "Host / Hostess",
      description: "Greeting and seating guests at a restaurant",
      hidden: false,
    },
    {
      name: "Delivery Driver",
      description: "Delivering food or packages to customers",
      hidden: false,
    },
    {
      name: "Event Staff",
      description: "Assisting with event setup, service, and teardown",
      hidden: false,
    },
    {
      name: "Security Guard",
      description: "Ensuring safety and security of premises",
      hidden: true,
    },
    {
      name: "Warehouse Worker",
      description: "Picking, packing, and organizing stock",
      hidden: true,
    },
  ];
  const pts = [];
  for (const d of ptData) {
    pts.push(await prisma.positionType.create({ data: d }));
  }

  /* ---------- Admin (1) ---------- */
  const adminAcct = await prisma.account.create({
    data: {
      email: "admin1@csc309.utoronto.ca",
      password: HASH,
      role: "admin",
      activated: true,
    },
  });
  await prisma.admin.create({ data: { id: adminAcct.id, utorid: "admin001" } });

  /* ---------- Regular Users (20) ---------- */
  const users = [];
  for (let i = 1; i <= 20; i++) {
    const acct = await prisma.account.create({
      data: {
        email: `regular${i}@csc309.utoronto.ca`,
        password: HASH,
        role: "regular",
        activated: i <= 12,
      },
    });
    const u = await prisma.regularUser.create({
      data: {
        id: acct.id,
        first_name: firstNames[(i - 1) % firstNames.length],
        last_name: lastNames[(i - 1) % lastNames.length],
        phone_number: phone(i),
        postal_address: addr(i),
        birthday: bday(i),
        available: true,
        suspended: i === 20, // user 20 suspended
        lastActiveAt: new Date(now - (i % 3) * 60 * 1000), // within 5-min availability_timeout
      },
    });
    users.push(u);
  }

  /* ---------- Businesses (12) ---------- */
  const bizNames = [
    "Downtown Cafe",
    "Night Owl Bar",
    "Queen Street Grill",
    "The Maple Leaf Diner",
    "Lakeside Lounge",
    "Bloor Street Bakery",
    "Campus Coffee Co.",
    "Harbour Eats",
    "King West Kitchen",
    "Yonge Street Sushi",
    "Liberty Village Bistro",
    "Distillery Deli",
  ];
  const ownerNames = [
    "Carol White",
    "Dave Brown",
    "Emily Chen",
    "Frank Torres",
    "Grace Kim",
    "Hank Patel",
    "Irene Novak",
    "Jake Rivera",
    "Karen Zhao",
    "Leo Thompson",
    "Monica Reyes",
    "Nathan Ford",
  ];
  const bizCoords = [
    [-79.383, 43.649],
    [-79.389, 43.65],
    [-79.395, 43.652],
    [-79.38, 43.655],
    [-79.377, 43.64],
    [-79.4, 43.66],
    [-79.397, 43.663],
    [-79.375, 43.643],
    [-79.39, 43.645],
    [-79.385, 43.661],
    [-79.42, 43.638],
    [-79.36, 43.65],
  ];

  const businesses = [];
  for (let i = 1; i <= 12; i++) {
    const acct = await prisma.account.create({
      data: {
        email: `business${i}@csc309.utoronto.ca`,
        password: HASH,
        role: "business",
        activated: i <= 10,
      },
    });
    const biz = await prisma.business.create({
      data: {
        id: acct.id,
        business_name: bizNames[i - 1],
        owner_name: ownerNames[i - 1],
        phone_number: phone(100 + i),
        postal_address: addr(i + 10),
        lon: bizCoords[i - 1][0],
        lat: bizCoords[i - 1][1],
        verified: i <= 10, // businesses 11-12 unverified
      },
    });
    businesses.push(biz);
  }

  /* ---------- Qualifications (25 — mix of statuses) ---------- */
  //  statuses: created, approved, rejected
  const qualData = [
    // user 1 (regular1) — multi-qualified; needs enough approved types for My Interests pagination
    { uid: 0, ptid: 0, status: "approved" }, // Waiter
    { uid: 0, ptid: 1, status: "approved" }, // Bartender
    { uid: 0, ptid: 2, status: "approved" }, // Cook
    { uid: 0, ptid: 3, status: "approved" }, // Cashier
    { uid: 0, ptid: 4, status: "approved" }, // Cleaner
    { uid: 0, ptid: 5, status: "created" }, // Barista (pending — not approved)
    // user 2 (regular2) — multi-qualified; needs enough approved types for Invitations pagination
    { uid: 1, ptid: 0, status: "approved" }, // Waiter
    { uid: 1, ptid: 1, status: "approved" }, // Bartender
    { uid: 1, ptid: 2, status: "approved" }, // Cook
    { uid: 1, ptid: 6, status: "approved" }, // Dishwasher
    { uid: 1, ptid: 7, status: "approved" }, // Host/Hostess
    { uid: 1, ptid: 8, status: "approved" }, // Delivery Driver
    // user 3
    { uid: 2, ptid: 0, status: "approved" },
    { uid: 2, ptid: 3, status: "rejected" },
    // user 4
    { uid: 3, ptid: 4, status: "approved" },
    { uid: 3, ptid: 7, status: "created" },
    // user 5
    { uid: 4, ptid: 1, status: "approved" },
    { uid: 4, ptid: 8, status: "approved" },
    // user 6
    { uid: 5, ptid: 2, status: "approved" },
    { uid: 5, ptid: 9, status: "created" },
    // user 7
    { uid: 6, ptid: 0, status: "approved" },
    { uid: 6, ptid: 5, status: "approved" },
    // user 8
    { uid: 7, ptid: 3, status: "approved" },
    { uid: 7, ptid: 6, status: "rejected" },
    // user 9
    { uid: 8, ptid: 4, status: "approved" },
    // user 10
    { uid: 9, ptid: 1, status: "approved" },
    { uid: 9, ptid: 2, status: "created" },
    // users 11-15 — one each
    { uid: 10, ptid: 0, status: "approved" },
    { uid: 11, ptid: 2, status: "approved" },
    { uid: 12, ptid: 1, status: "approved" },
    { uid: 13, ptid: 3, status: "created" },
    { uid: 14, ptid: 4, status: "rejected" },
    // -- Gap filling: ensure ≥3 approved per visible position type --
    // ptid 3 (Cashier): was 2 approved (uid 0, 7) — add 1
    { uid: 5, ptid: 3, status: "approved" },
    // ptid 5 (Barista): was 1 approved (uid 6) — add 2
    { uid: 3, ptid: 5, status: "approved" },
    { uid: 9, ptid: 5, status: "approved" },
    // ptid 6 (Dishwasher): was 1 approved (uid 1) — add 2
    { uid: 3, ptid: 6, status: "approved" },
    { uid: 8, ptid: 6, status: "approved" },
    // ptid 7 (Host/Hostess): was 1 approved (uid 1) — add 2
    { uid: 2, ptid: 7, status: "approved" },
    { uid: 5, ptid: 7, status: "approved" },
    // ptid 8 (Delivery Driver): was 2 approved (uid 1, 4) — add 1
    { uid: 8, ptid: 8, status: "approved" },
    // ptid 9 (Event Staff): was 0 approved — add 3
    { uid: 10, ptid: 9, status: "approved" },
    { uid: 12, ptid: 9, status: "approved" },
    { uid: 14, ptid: 9, status: "approved" },
  ];
  const quals = [];
  for (const q of qualData) {
    quals.push(
      await prisma.qualification.create({
        data: {
          userId: users[q.uid].id,
          positionTypeId: pts[q.ptid].id,
          status: q.status,
        },
      })
    );
  }

  // Build lookup: user array index → Set of approved positionType DB IDs
  const approvedPtIdByUser = new Map();
  for (const q of qualData) {
    if (q.status === "approved") {
      if (!approvedPtIdByUser.has(q.uid))
        approvedPtIdByUser.set(q.uid, new Set());
      approvedPtIdByUser.get(q.uid).add(pts[q.ptid].id);
    }
  }

  /* ---------- Jobs (45) ---------- */
  // Mix of open, filled, closed, and past jobs
  const jobDefs = [];
  // 12 open future jobs for business[0] (Downtown Cafe) — ensures 11+ for "My Jobs" pagination
  for (let i = 0; i < 12; i++) {
    const startOff = (0.5 + i * 0.5) * day; // 0.5 to 6 days — all within 7-day window
    jobDefs.push({
      ptIdx: i % 10,
      bizIdx: 0,
      salary_min: 15 + (i % 6),
      salary_max: 20 + (i % 8),
      start_time: new Date(now + startOff),
      end_time: new Date(now + startOff + 8 * hour),
      note: `Downtown Cafe shift #${i + 1}`,
      status: "open",
      workerIdx: null,
    });
  }
  // 10 more open jobs spread across other businesses
  for (let i = 0; i < 10; i++) {
    const startOff = (1 + i * 0.5) * day; // 1 to 5.5 days — all within 7-day window
    jobDefs.push({
      ptIdx: i % 10,
      bizIdx: (i % 9) + 1, // businesses 1-9
      salary_min: 15 + (i % 6),
      salary_max: 21 + (i % 7),
      start_time: new Date(now + startOff),
      end_time: new Date(now + startOff + 8 * hour),
      note: `Open shift #${i + 1}`,
      status: "open",
      workerIdx: null,
    });
  }
  // 12 filled jobs (past, assigned to workers)
  for (let i = 0; i < 12; i++) {
    const startOff = -(12 - i) * day;
    jobDefs.push({
      ptIdx: i % 10,
      bizIdx: i % 10,
      salary_min: 16 + (i % 4),
      salary_max: 22 + (i % 5),
      start_time: new Date(now + startOff),
      end_time: new Date(now + startOff + 8 * hour),
      note: `Filled shift #${i + 1}`,
      status: "filled",
      workerIdx: i % 16,
    });
  }
  // 1 filled job currently IN-PROGRESS (for testing no-show)
  jobDefs.push({
    ptIdx: 0,
    bizIdx: 0, // business1
    salary_min: 18,
    salary_max: 25,
    start_time: new Date(now - 2 * hour),
    end_time: new Date(now + 6 * hour),
    note: "Currently in-progress shift (test no-show)",
    status: "filled",
    workerIdx: 2, // regular3
  });

  // 6 upcoming filled jobs (future start, worker already assigned)
  const upcomingFilled = [
    { ptIdx: 0, bizIdx: 1, startOff: 1.0 * day, workerIdx: 2 },  // Waiter — user3
    { ptIdx: 1, bizIdx: 2, startOff: 1.5 * day, workerIdx: 4 },  // Bartender — user5
    { ptIdx: 2, bizIdx: 3, startOff: 2.0 * day, workerIdx: 5 },  // Cook — user6
    { ptIdx: 4, bizIdx: 4, startOff: 2.5 * day, workerIdx: 3 },  // Cleaner — user4
    { ptIdx: 5, bizIdx: 5, startOff: 3.0 * day, workerIdx: 6 },  // Barista — user7
    { ptIdx: 8, bizIdx: 6, startOff: 3.5 * day, workerIdx: 4 },  // Delivery Driver — user5
  ];
  for (const f of upcomingFilled) {
    jobDefs.push({
      ptIdx: f.ptIdx,
      bizIdx: f.bizIdx,
      salary_min: 16,
      salary_max: 22,
      start_time: new Date(now + f.startOff),
      end_time: new Date(now + f.startOff + 8 * hour),
      note: `Upcoming filled shift`,
      status: "filled",
      workerIdx: f.workerIdx,
    });
  }

  // 6 closed / cancelled jobs
  for (let i = 0; i < 6; i++) {
    const startOff = (1 + i * 1) * day; // 1 to 6 days — all within 7-day window
    jobDefs.push({
      ptIdx: (i + 3) % 10,
      bizIdx: (i + 2) % 10,
      salary_min: 14 + i,
      salary_max: 19 + i,
      start_time: new Date(now + startOff),
      end_time: new Date(now + startOff + 6 * hour),
      note: `Closed posting #${i + 1}`,
      status: "closed",
      workerIdx: null,
    });
  }
  // 5 past open jobs
  for (let i = 0; i < 5; i++) {
    const startOff = -(20 + i * 2) * day;
    jobDefs.push({
      ptIdx: (i + 5) % 10,
      bizIdx: (i + 1) % 10,
      salary_min: 15,
      salary_max: 20,
      start_time: new Date(now + startOff),
      end_time: new Date(now + startOff + 8 * hour),
      note: `Past open posting #${i + 1}`,
      status: "open",
      workerIdx: null,
    });
  }

  const jobs = [];
  for (const jd of jobDefs) {
    jobs.push(
      await prisma.job.create({
        data: {
          positionTypeId: pts[jd.ptIdx].id,
          businessId: businesses[jd.bizIdx].id,
          salary_min: jd.salary_min,
          salary_max: jd.salary_max,
          start_time: jd.start_time,
          end_time: jd.end_time,
          note: jd.note,
          status: jd.status,
          ...(jd.workerIdx != null ? { workerId: users[jd.workerIdx].id } : {}),
        },
      })
    );
  }

  /* ---------- Interests (70+) ---------- */
  const interests = [];
  const seenPairs = new Set();

  // Returns true if the user (by array index) has an approved qual for this job's position type
  function userQualifiesForJob(uIdx, jIdx) {
    const ptId = jobs[jIdx]?.positionTypeId;
    return approvedPtIdByUser.get(uIdx)?.has(ptId) ?? false;
  }

  async function addInterest(jobIdx, userIdx, candInt, bizInt) {
    const key = `${jobs[jobIdx].id}-${users[userIdx].id}`;
    if (seenPairs.has(key)) return null;
    seenPairs.add(key);
    const intr = await prisma.interest.create({
      data: {
        jobId: jobs[jobIdx].id,
        candidateId: users[userIdx].id,
        candidateInterested: candInt,
        businessInterested: bizInt,
      },
    });
    interests.push(intr);
    return intr;
  }

  // Give user[0] (regular1) interests in qualifying jobs — ensures "My Interests" pagination
  {
    const qualJobs = jobs
      .map((_, j) => j)
      .filter((j) => userQualifiesForJob(0, j));
    for (let i = 0; i < Math.min(14, qualJobs.length); i++) {
      await addInterest(qualJobs[i], 0, true, i < 7 ? true : null); // half mutual, half pending
    }
  }

  // Give user[1] (regular2) qualifying invitations — ensures "Invitations" pagination
  {
    const qualJobs = jobs
      .map((_, j) => j)
      .filter((j) => userQualifiesForJob(1, j));
    for (let i = 0; i < Math.min(14, qualJobs.length); i++) {
      await addInterest(qualJobs[i], 1, null, true); // business invited, candidate hasn't replied
    }
  }

  // Spread interests across other users for variety (only for jobs they qualify for)
  for (let j = 0; j < 22; j++) {
    const uIdx = (j % 14) + 2; // users 2-15
    const jIdx = j % jobs.length;
    if (!userQualifiesForJob(uIdx, jIdx)) continue;
    const mutual = j % 3 === 0;
    const declined = j % 5 === 0;
    await addInterest(
      jIdx,
      uIdx,
      true,
      mutual ? true : declined ? false : null
    );
  }

  // Additional invitations spread across users 3-10 (only for jobs they qualify for)
  for (let j = 0; j < 12; j++) {
    const uIdx = (j % 8) + 2;
    const jIdx = (j + 14) % jobs.length;
    if (!userQualifiesForJob(uIdx, jIdx)) continue;
    await addInterest(jIdx, uIdx, null, true);
  }

  // Extra interests on filled jobs (for history)
  for (let j = 22; j < 34; j++) {
    const base = ((j - 22) * 2 + 5) % 16;
    if (j < jobs.length && userQualifiesForJob(base, j)) {
      await addInterest(j, base, true, true);
    }
  }

  /* ---------- Negotiations (18+) ---------- */
  // Create negotiations for mutual-interest entries
  const mutualInterests = interests.filter(
    (intr) =>
      intr.candidateInterested === true && intr.businessInterested === true
  );
  const negotiations = [];
  const activeCandidates = new Set();
  const activeBusinesses = new Set();
  let activeCount = 0;
  for (let i = 0; i < mutualInterests.length && i < 20; i++) {
    const intr = mutualInterests[i];
    // find the job for this interest
    const job = jobs.find((j) => j.id === intr.jobId);
    const bizId = job ? job.businessId : businesses[0].id;

    let status, candDec, bizDec, expiresOff;
    if (
      activeCount < 6 &&
      !activeCandidates.has(intr.candidateId) &&
      !activeBusinesses.has(bizId)
    ) {
      // active negotiation — only if this candidate & business don't already have one
      status = "active";
      candDec = null;
      bizDec = null;
      expiresOff = 12 * hour;
      activeCandidates.add(intr.candidateId);
      activeBusinesses.add(bizId);
      activeCount++;
    } else if (i < 10) {
      // both accepted → success
      status = "success";
      candDec = "accept";
      bizDec = "accept";
      expiresOff = -1 * hour;
    } else if (i < 12) {
      // candidate declined → failed
      status = "failed";
      candDec = "decline";
      bizDec = null;
      expiresOff = -2 * hour;
    } else if (i < 15) {
      // business declined → failed
      status = "failed";
      candDec = null;
      bizDec = "decline";
      expiresOff = -3 * hour;
    } else {
      // expired — status stays "active", expiry is expressed by expiresAt in the past
      status = "active";
      candDec = null;
      bizDec = null;
      expiresOff = -6 * hour;
    }

    negotiations.push(
      await prisma.negotiation.create({
        data: {
          interestId: intr.id,
          jobId: intr.jobId,
          candidateId: intr.candidateId,
          businessId: bizId,
          status,
          candidateDecision: candDec,
          businessDecision: bizDec,
          expiresAt: new Date(now + expiresOff),
        },
      })
    );
  }

  /* ---------- Summary ---------- */
  console.log("Seed complete:");
  console.log(`  Position types : ${pts.length}`);
  console.log(`  Admins         : 1`);
  console.log(`  Regular users  : ${users.length}`);
  console.log(`  Businesses     : ${businesses.length}`);
  console.log(`  Qualifications : ${quals.length}`);
  console.log(`  Jobs           : ${jobs.length}`);
  console.log(`  Interests      : ${interests.length}`);
  console.log(`  Negotiations   : ${negotiations.length}`);
  console.log(`All passwords: 123123`);
}

main()
  .catch((error) => {
    console.error("Failed to initialize database.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
