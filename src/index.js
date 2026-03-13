const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
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

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Service health check
 *     description: Returns the current status of the API.
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   example: "2024-01-01T00:00:00.000Z"
 *                 service:
 *                   type: string
 *                   example: yt-2-mp4
 */
app.get("/health", (req, res) => {
    res.json({
        success: true,
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "yt-2-mp4",
    });
});

// Swagger UI
app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: "yt-2-mp4 API Docs",
        customCss: `
      .swagger-ui .topbar { background-color: #ff0000; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #ff0000; }
    `,
        swaggerOptions: {
            persistAuthorization: true,
        },
    })
);

// OpenAPI JSON spec endpoint
app.get("/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 yt-2-mp4 API running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 Swagger UI:   http://localhost:${PORT}/docs`);
    console.log(`📥 Download:     POST http://localhost:${PORT}/api/download`);
    console.log(`ℹ️  Info:        POST http://localhost:${PORT}/api/info`);
});
