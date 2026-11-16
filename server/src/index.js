const express = require("express");
const cors = require("cors");
const { uptime } = require("node:process");
const { version } = require("node:os");
const { error } = require("node:console");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const API_VERSION = process.env.API_VERSION || "0.1.0";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
        status: "ok",
        uptime: Math.round(process.uptime()),
        version: API_VERSION,
    });
});

app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
});

app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Invalid JSON body" });
    }

    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
})

const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`API listening on http://127.0.0.1:${PORT}`);
});

function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
