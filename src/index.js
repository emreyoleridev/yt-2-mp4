const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const downloadRoutes = require("./routes/download");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "yt-2-mp4",
  });
});

// Routes
app.use("/api", downloadRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res
    .status(500)
    .json({ success: false, error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 yt-2-mp4 API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📥 Download:     POST http://localhost:${PORT}/api/download`);
  console.log(`ℹ️  Info:        POST http://localhost:${PORT}/api/info`);
});
