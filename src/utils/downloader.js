const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || "/tmp/downloads";

// Ensure download directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

/**
 * Validate YouTube URL
 */
function isValidYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
        /^https?:\/\/youtu\.be\/[\w-]{11}/,
        /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]{11}/,
    ];
    return patterns.some((p) => p.test(url));
}

/**
 * Get video info from YouTube URL
 */
function getVideoInfo(url) {
    return new Promise((resolve, reject) => {
        const args = [
            "--dump-json",
            "--no-playlist",
            "--no-warnings",
            url,
        ];

        const proc = spawn("yt-dlp", args);
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (d) => (stdout += d.toString()));
        proc.stderr.on("data", (d) => (stderr += d.toString()));

        proc.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`yt-dlp failed: ${stderr.trim()}`));
            }
            try {
                const info = JSON.parse(stdout);
                resolve({
                    id: info.id,
                    title: info.title,
                    duration: info.duration,
                    durationString: info.duration_string,
                    thumbnail: info.thumbnail,
                    uploader: info.uploader,
                    viewCount: info.view_count,
                    uploadDate: info.upload_date,
                    description: info.description?.slice(0, 300),
                    formats: info.formats
                        ?.filter((f) => f.ext === "mp4" && f.height)
                        .map((f) => ({
                            formatId: f.format_id,
                            quality: `${f.height}p`,
                            height: f.height,
                            fps: f.fps,
                            filesize: f.filesize,
                        }))
                        .sort((a, b) => b.height - a.height),
                });
            } catch (e) {
                reject(new Error("Failed to parse video info"));
            }
        });

        proc.on("error", (err) => {
            reject(new Error(`Failed to run yt-dlp: ${err.message}`));
        });
    });
}

/**
 * Download YouTube video as MP4
 * @param {string} url - YouTube URL
 * @param {string} quality - "best", "1080", "720", "480", "360"
 * @param {string} outputId - Unique ID for output file
 * @param {function} onProgress - Progress callback
 */
function downloadVideo(url, quality = "best", outputId, onProgress) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(DOWNLOADS_DIR, `${outputId}.mp4`);

        // Build format selector
        let formatSelector;
        if (quality === "best") {
            formatSelector = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
        } else {
            const h = parseInt(quality);
            formatSelector = `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${h}][ext=mp4]/best[height<=${h}]`;
        }

        const args = [
            "--format", formatSelector,
            "--merge-output-format", "mp4",
            "--output", outputPath,
            "--no-playlist",
            "--no-warnings",
            "--newline",
            url,
        ];

        const proc = spawn("yt-dlp", args);
        let stderr = "";

        proc.stdout.on("data", (data) => {
            const line = data.toString().trim();
            // Parse progress lines like: [download]  45.2% of 123.45MiB
            const match = line.match(/\[download\]\s+([\d.]+)%/);
            if (match && onProgress) {
                onProgress(parseFloat(match[1]));
            }
        });

        proc.stderr.on("data", (d) => (stderr += d.toString()));

        proc.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`Download failed: ${stderr.trim()}`));
            }
            if (!fs.existsSync(outputPath)) {
                return reject(new Error("Output file not found after download"));
            }
            const stat = fs.statSync(outputPath);
            resolve({ filePath: outputPath, fileSize: stat.size });
        });

        proc.on("error", (err) => {
            reject(new Error(`Failed to run yt-dlp: ${err.message}`));
        });
    });
}

/**
 * Cleanup a file after use
 */
function cleanup(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.error("[CLEANUP] Failed to delete file:", filePath, e.message);
    }
}

module.exports = { isValidYouTubeUrl, getVideoInfo, downloadVideo, cleanup, DOWNLOADS_DIR };
