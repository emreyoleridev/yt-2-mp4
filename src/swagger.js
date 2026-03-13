const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "yt-2-mp4 API",
            version: "1.0.0",
            description:
                "A REST API for downloading YouTube videos as MP4 files. Powered by `yt-dlp` and `ffmpeg`.",
            contact: {
                name: "yt-2-mp4",
            },
        },
        servers: [
            {
                url: process.env.BASE_URL || "http://localhost:3000",
                description: "API Server",
            },
        ],
        tags: [
            { name: "Health", description: "Service health check" },
            { name: "Video", description: "Video info and download operations" },
        ],
        components: {
            schemas: {
                UrlRequest: {
                    type: "object",
                    required: ["url"],
                    properties: {
                        url: {
                            type: "string",
                            example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            description: "A valid YouTube video URL",
                        },
                        quality: {
                            type: "string",
                            enum: ["best", "1080", "720", "480", "360", "240"],
                            default: "best",
                            description: "Desired video quality",
                        },
                    },
                },
                VideoFormat: {
                    type: "object",
                    properties: {
                        formatId: { type: "string", example: "137" },
                        quality: { type: "string", example: "1080p" },
                        height: { type: "integer", example: 1080 },
                        fps: { type: "number", example: 30 },
                        filesize: { type: "integer", example: 52428800, nullable: true },
                    },
                },
                VideoInfo: {
                    type: "object",
                    properties: {
                        id: { type: "string", example: "dQw4w9WgXcQ" },
                        title: {
                            type: "string",
                            example: "Rick Astley - Never Gonna Give You Up",
                        },
                        duration: { type: "integer", example: 212 },
                        durationString: { type: "string", example: "3:32" },
                        thumbnail: {
                            type: "string",
                            example: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
                        },
                        uploader: { type: "string", example: "Rick Astley" },
                        viewCount: { type: "integer", example: 1500000000 },
                        uploadDate: { type: "string", example: "20091025" },
                        description: { type: "string", example: "Official music video..." },
                        formats: {
                            type: "array",
                            items: { $ref: "#/components/schemas/VideoFormat" },
                        },
                    },
                },
                SuccessResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        data: { type: "object" },
                    },
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        error: { type: "string", example: "Invalid YouTube URL" },
                    },
                },
            },
        },
    },
    apis: ["./src/routes/*.js", "./src/index.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
