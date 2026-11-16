const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const DB_PATH = path.join(__dirname, "..", "db.json");
const API_VERSION = process.env.API_VERSION || "0.1.0";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

function readApplications() {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const db = JSON.parse(raw);

    if (!Array.isArray(db.applications)) {
        throw new Error("db.json must contain an applications array");
    }

    return db.applications;
}

app.get("/health", (_req, res) => {
    res.set("Cache-control", "no-store");
    res.json({
        status: "ok",
        uptime: Math.round(process.uptime()),
        version: API_VERSION,
    });
});

app.get("/applications", (_req, res) => {
    res.json(readApplications());
});

app.get("/applications/:id", (req, res) => {
    const application = readApplications().find((item) => String(item.id) === req.params.id);

    if (!application) {
        return res.status(404).json({ error: "Application not found" });
    }

    return res.json(application);
});

app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Invalid JSON body" });
    }

    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
});

module.exports = { app };