const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const {
    isValidYouTubeUrl,
    getVideoInfo,
    downloadVideo,
    cleanup,
} = require("../utils/downloader");

/**
 * @openapi
 * /api/info:
 *   post:
 *     tags: [Video]
 *     summary: Get video metadata
 *     description: Returns metadata for a YouTube video without downloading it.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url:
 *                 type: string
 *                 example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
 *                 description: A valid YouTube video URL
 *     responses:
 *       200:
 *         description: Video metadata retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/VideoInfo'
 *       400:
 *         description: Missing or invalid URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to fetch video info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/info", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: "url is required" });
    }

    if (!isValidYouTubeUrl(url)) {
        return res.status(400).json({
            success: false,
            error: "Invalid YouTube URL",
        });
    }

    try {
        console.log(`[INFO] Fetching info for: ${url}`);
        const info = await getVideoInfo(url);
        res.json({ success: true, data: info });
    } catch (err) {
        console.error("[INFO] Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @openapi
 * /api/download:
 *   post:
 *     tags: [Video]
 *     summary: Download a YouTube video as MP4
 *     description: >
 *       Downloads the specified YouTube video and streams it as an MP4 file.
 *       The `Content-Disposition` header will include the video title as the filename.
 *       Supported URL formats: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UrlRequest'
 *     responses:
 *       200:
 *         description: MP4 file stream
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="video_title_720.mp4"'
 *           X-File-Size-MB:
 *             schema:
 *               type: string
 *               example: "45.23"
 *           X-Quality:
 *             schema:
 *               type: string
 *               example: "720"
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing or invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Download failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/download", async (req, res) => {
    const { url, quality = "best" } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: "url is required" });
    }

    if (!isValidYouTubeUrl(url)) {
        return res.status(400).json({
            success: false,
            error: "Invalid YouTube URL",
        });
    }

    const validQualities = ["best", "1080", "720", "480", "360", "240"];
    if (!validQualities.includes(String(quality))) {
        return res.status(400).json({
            success: false,
            error: `Invalid quality. Must be one of: ${validQualities.join(", ")}`,
        });
    }

    const outputId = uuidv4();
    let filePath = null;

    try {
        console.log(`[DOWNLOAD] Starting: ${url} | quality: ${quality}`);

        // Step 1: Get video title for filename
        let videoTitle = outputId;
        try {
            const info = await getVideoInfo(url);
            videoTitle = info.title
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, "_")
                .slice(0, 80);
        } catch (_) {
            // Fallback to UUID if info fetch fails
        }

        // Step 2: Download
        const result = await downloadVideo(
            url,
            String(quality),
            outputId,
            (progress) => {
                console.log(`[DOWNLOAD] Progress: ${progress.toFixed(1)}%`);
            }
        );

        filePath = result.filePath;
        const fileSizeMB = (result.fileSize / (1024 * 1024)).toFixed(2);
        console.log(`[DOWNLOAD] Complete: ${fileSizeMB} MB → ${filePath}`);

        // Step 3: Stream file to client
        const filename = `${videoTitle}_${quality}.mp4`;
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(filename)}"`
        );
        res.setHeader("Content-Length", result.fileSize);
        res.setHeader("X-File-Size-MB", fileSizeMB);
        res.setHeader("X-Quality", quality);

        const { createReadStream } = require("fs");
        const stream = createReadStream(filePath);

        stream.on("end", () => cleanup(filePath));
        stream.on("error", (err) => {
            console.error("[STREAM] Error:", err.message);
            cleanup(filePath);
        });

        stream.pipe(res);
    } catch (err) {
        console.error("[DOWNLOAD] Error:", err.message);
        if (filePath) cleanup(filePath);

        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

/**
 * @openapi
 * /api/qualities:
 *   get:
 *     tags: [Video]
 *     summary: List supported quality options
 *     description: Returns all available quality values that can be passed to the download endpoint.
 *     responses:
 *       200:
 *         description: Quality options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     qualities:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["best", "1080", "720", "480", "360", "240"]
 *                     note:
 *                       type: string
 *                       example: "'best' selects the highest available quality"
 */
router.get("/qualities", (req, res) => {
    res.json({
        success: true,
        data: {
            qualities: ["best", "1080", "720", "480", "360", "240"],
            note: "'best' selects the highest available quality",
        },
    });
});

module.exports = router;
