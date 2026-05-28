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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});