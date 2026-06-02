const express = require("express");
const router = express.Router();

// TEMP USERS (same structure as your DB)
let users = [
  {
    user_id: 1,
    name: "Sean",
    email: "admin@test.com",
    password: "1234",
    role: "admin",
    department: "IT"
  },
  {
    user_id: 2,
    name: "Employee",
    email: "user@test.com",
    password: "1234",
    role: "employee",
    department: "Accounting"
  }
];

// ✅ LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials"
    });
  }

  res.json({
    message: "Login successful",
    user: {
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      department: user.department
    }
  });
});

module.exports = router;
