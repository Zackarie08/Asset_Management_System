const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ routes
const inventoryRoutes = require("./routes/inventory");
const authRoutes = require("./routes/auth");

app.use("/api/inventory", inventoryRoutes);
app.use("/api/auth", authRoutes);

// ✅ test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// Logs
const logsRoutes = require("./routes/logs");

app.use("/api/logs", logsRoutes);

const locationRoutes = require("./routes/location");
app.use("/api/location", locationRoutes);

const poRoutes = require("./routes/po");
app.use("/api/po", poRoutes);

const vehicleRoutes = require('./routes/vehicle');
app.use('/api/vehicle', vehicleRoutes);


app.use("/api/furniture", require("./routes/furniture"));

app.use("/api/it-supplies", require("./routes/itSupplies"));

app.use("/api/globe", require("./routes/globe"));