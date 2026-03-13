const { Innertube } = require("youtubei.js");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || "/tmp/downloads";

if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Singleton Innertube instance
let _yt = null;

async function getInnertube() {
    if (!_yt) {
        _yt = await Innertube.create();
        console.log("[INNERTUBE] Session created");
    }
    return _yt;
}

/**
 * Extract YouTube video ID from URL
 */
function extractVideoId(url) {
    const m = url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

/**
 * Validate YouTube URL
 */
function isValidYouTubeUrl(url) {
    return !!extractVideoId(url);
}

/**
 * Get a format's streaming URL (handles ciphered and plain)
 */
function getFormatUrl(format, player) {
    if (format.url) return format.url;
    return format.decipher(player);
}

/**
 * Format seconds → MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Get video info from YouTube URL
 */
async function getVideoInfo(url) {
    const id = extractVideoId(url);
    if (!id) throw new Error("Invalid YouTube URL");

    try {
        const yt = await getInnertube();
        const info = await yt.getInfo(id);
        const bi = info.basic_info;

        const videoFormats = (info.streaming_data?.adaptive_formats ?? [])
            .filter((f) => f.has_video && !f.has_audio && f.mime_type?.startsWith("video/mp4"))
            .map((f) => ({
                formatId: String(f.itag),
                quality: `${f.height}p`,
                height: f.height,
                fps: f.fps,
                filesize: f.content_length ? parseInt(f.content_length) : null,
            }))
            .sort((a, b) => b.height - a.height);

        return {
            id: bi.id,
            title: bi.title,
            duration: bi.duration,
            durationString: formatDuration(bi.duration),
            thumbnail: bi.thumbnail?.[0]?.url,
            uploader: bi.channel?.name,
            viewCount: bi.view_count,
            description: bi.short_description?.slice(0, 300),
            formats: videoFormats,
        };
    } catch (err) {
        _yt = null; // reset on error so next call retries
        throw err;
    }
}

/**
 * Download YouTube video as MP4
 * Uses youtubei.js to get stream URLs, then ffmpeg to merge video + audio.
 */
async function downloadVideo(url, quality = "best", outputId, onProgress) {
    const id = extractVideoId(url);
    if (!id) throw new Error("Invalid YouTube URL");

    let info, player;
    try {
        const yt = await getInnertube();
        info = await yt.getInfo(id);
        player = yt.session.player;
    } catch (err) {
        _yt = null;
        throw err;
    }

    const outputPath = path.join(DOWNLOADS_DIR, `${outputId}.mp4`);
    const adaptive = info.streaming_data?.adaptive_formats ?? [];

    // Video-only MP4 formats
    const videoFormats = adaptive
        .filter((f) => f.has_video && !f.has_audio && f.mime_type?.startsWith("video/mp4"))
        .sort((a, b) => b.height - a.height);

    // Audio-only formats
    const audioFormats = adaptive
        .filter((f) => f.has_audio && !f.has_video)
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

    if (!videoFormats.length) throw new Error("No video formats available");
    if (!audioFormats.length) throw new Error("No audio formats available");

    // Pick video format by quality
    let videoFormat;
    if (quality === "best") {
        videoFormat = videoFormats[0];
    } else {
        const targetH = parseInt(quality);
        videoFormat =
            videoFormats.find((f) => f.height <= targetH) ??
            videoFormats[videoFormats.length - 1];
    }
    const audioFormat = audioFormats[0];

    const videoUrl = getFormatUrl(videoFormat, player);
    const audioUrl = getFormatUrl(audioFormat, player);

    console.log(`[DOWNLOAD] Video: ${videoFormat.height}p | Audio: ${audioFormat.bitrate}bps`);

    return new Promise((resolve, reject) => {
        // ffmpeg -i <videoUrl> -i <audioUrl> -c:v copy -c:a aac <output>
        const args = [
            "-y",
            "-i", videoUrl,
            "-i", audioUrl,
            "-c:v", "copy",
            "-c:a", "aac",
            "-movflags", "+faststart",
            outputPath,
        ];

        const proc = spawn("ffmpeg", args);
        let stderr = "";

        proc.stderr.on("data", (d) => {
            const chunk = d.toString();
            stderr += chunk;
            // Parse ffmpeg progress: "time=00:01:23.45"
            const m = chunk.match(/time=(\d+):(\d+):([\d.]+)/);
            if (m && onProgress && info.basic_info.duration) {
                const elapsed = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
                onProgress(Math.min(100, (elapsed / info.basic_info.duration) * 100));
            }
        });

        proc.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`ffmpeg failed (code ${code}): ${stderr.slice(-500)}`));
            }
            if (!fs.existsSync(outputPath)) {
                return reject(new Error("Output file not found after merge"));
            }
            const stat = fs.statSync(outputPath);
            resolve({ filePath: outputPath, fileSize: stat.size });
        });

        proc.on("error", (err) => {
            reject(new Error(`Failed to run ffmpeg: ${err.message}`));
        });
    });
}

/**
 * Cleanup a temp file after streaming
 */
function cleanup(filePath) {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        console.error("[CLEANUP] Failed:", filePath, e.message);
    }
}

module.exports = { isValidYouTubeUrl, getVideoInfo, downloadVideo, cleanup, DOWNLOADS_DIR };
