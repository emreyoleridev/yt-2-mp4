const express = require("express");
const router = express.Router();
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
    isValidYouTubeUrl,
    getVideoInfo,
    downloadVideo,
    cleanup,
} = require("../utils/downloader");

/**
 * POST /api/info
 * Get video metadata without downloading
 *
 * Body: { url: string }
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
 * POST /api/download
 * Download a YouTube video as MP4 and stream it to the client
 *
 * Body: { url: string, quality?: "best" | "1080" | "720" | "480" | "360" }
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
            // Fallback to UUID if info fails
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

        stream.on("end", () => {
            cleanup(filePath);
        });

        stream.on("error", (err) => {
            console.error("[STREAM] Error:", err.message);
            cleanup(filePath);
        });

        stream.pipe(res);
    } catch (err) {
        console.error("[DOWNLOAD] Error:", err.message);
        if (filePath) cleanup(filePath);

        // Only send JSON response if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

/**
 * GET /api/qualities
 * List supported quality options
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
