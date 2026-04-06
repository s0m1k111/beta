const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./modules/auth/authRoutes");
const userRoutes = require("./modules/users/userRoutes");
const friendRoutes = require("./modules/friends/friendRoutes");
const dmRoutes = require("./modules/dm/dmRoutes"); // ← добавили

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // поддержка JSON + base64

// Static frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/friends", friendRoutes);
app.use("/dm", dmRoutes); // ← добавили

// Test route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
