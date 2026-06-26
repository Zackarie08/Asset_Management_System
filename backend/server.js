// ============================================================
// server.js
// BUG FIX: subscriptionsMaster was mounted at /api/insurance
//           (same path as the real insurance router), causing
//           a route conflict. Fixed path to /api/subscriptions-master
// ============================================================
const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" })); // ← allow base64 attachment uploads up to ~10MB

/* ── ROUTES ─────────────────────────────────────────────── */
app.use("/api/inventory",             require("./routes/inventory"));
app.use("/api/auth",                  require("./routes/auth"));
app.use("/api/logs",                  require("./routes/logs"));
app.use("/api/location",              require("./routes/location"));
app.use("/api/po",                    require("./routes/po"));
app.use("/api/vehicle",               require("./routes/vehicle"));
app.use("/api/furniture",             require("./routes/furniture"));
app.use("/api/it-supplies",           require("./routes/itSupplies"));
app.use("/api/globe",                 require("./routes/globe"));
app.use("/api/m365",                  require("./routes/m365"));
app.use("/api/laptops",               require("./routes/laptops"));
app.use("/api/laptop-maintenance",    require("./routes/laptopMaintenance"));
app.use("/api/finance-documents",     require("./routes/finance"));
app.use("/api/contracts",             require("./routes/contracts"));
app.use("/api/attachments",           require("./routes/attachments"));
app.use("/api/subscriptions",         require("./routes/subscriptions"));
app.use("/api/insurance",             require("./routes/insurance"));
// ✅ FIX: was incorrectly mounted at /api/insurance (conflict!)
app.use("/api/subscriptions-master",  require("./routes/subscriptionsMaster"));
app.use("/api/vehicle-plans",         require("./routes/vehicleMaintPlans"));

/* ── HEALTH CHECK ───────────────────────────────────────── */
app.get("/", (req, res) => res.send("Server is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
