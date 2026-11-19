const express = require("express");
const cors = require("cors");
const { query } = require("./db");
const { applicationSchema, parseId } = require("./validation");

const API_VERSION = process.env.API_VERSION || "0.1.0";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const DEMO_USER_ID = Number(process.env.DEMO_USER_ID || 1);

const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());


function toApi(row) {
    return {
        id: row.id,
        company: row.company,
        role: row.role,
        jdUrl: row.jd_url,
        location: row.location,
        remote: row.remote,
        deadline: row.deadline ?? "",
        status: row.status,
        notes: row.notes,
    };
}

app.get("/health", (_req, res) => {
    res.set("Cache-control", "no-store");
    res.json({
        status: "ok",
        uptime: Math.round(process.uptime()),
        version: API_VERSION,
    });
});

app.get("/applications", async (_req, res) => {
    const { rows } = await query(
        `SELECT id, company, role, jd_url, location, remote,
            deadline::text AS deadline, status, notes
        FROM applications
        WHERE user_id = $1
        ORDER BY deadline ASC NULLS LAST, created_at DESC`,
        [DEMO_USER_ID],
    );
    res.json(rows.map(toApi));
});

app.get("/applications/:id", async (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: "Invalid id" });
    }

    const { rows } = await query(
        `SELECT id, company, role, jd_url, location, remote,
            deadline::text AS deadline, status, notes
        FROM applications
        WHERE id = $1 AND user_id = $2
        ORDER BY deadline ASC NULLS LAST, created_at DESC`,
        [id, DEMO_USER_ID],
    );

    if (rows.length === 0) {
        return res.status(404).json({ error: "Application not found" });
    }

    return res.json(toApi(rows[0]));
});

app.post("/applications", async (req, res) => {
    const result = applicationSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: "Invalid input",
            details: result.error.issues.map((issues) => ({
                path: issues.path,
                message: issues.message,
            })),
        });
    }

    const data = result.data;
    const deadline = data.deadline === "" ? null : data.deadline;

    const { rows } = await query(
        `INSERT INTO applications
            (user_id, company, role, jd_url, location, remote, deadline, status, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, company, role, jd_url, location, remote,
                deadline::text AS deadline, status, notes`,
        [
            DEMO_USER_ID,
            data.company,
            data.role,
            data.jdUrl,
            data.location,
            data.remote,
            deadline,
            data.status,
            data.notes,
        ],
    );
    return res.status(201).json(toApi(rows[0]));
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