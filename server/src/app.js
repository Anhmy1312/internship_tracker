const express = require("express");
const cors = require("cors");
const { query } = require("./db");
const { applicationSchema, parseId, applicationPatchSchema } = require("./validation");

const API_VERSION = process.env.API_VERSION || "0.1.0";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const DEMO_USER_ID = Number(process.env.DEMO_USER_ID || 1);

const COLUMNS = {
    company: "company",
    role: "role",
    jdUrl: "jd_url",
    location: "location",
    remote: "remote",
    deadline: "deadline",
    status: "status",
    notes: "notes",
};

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
        WHERE id = $1 AND user_id = $2`,
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

app.patch("/applications/:id", async (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: "Invalid id" });
    }

    if (Object.keys(req.body ?? {}).length === 0) {
        return res.status(400).json({ error: "No field to update" });
    }

    const result = applicationPatchSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid input",
            details: result.error.issues.map((issues) => ({
                path: issues.path,
                message: issues.message,
            })),
        });
    }

    const sets = [];
    const values = [];

    for (const [field, value] of Object.entries(result.data)) {
        const normalized = field === "deadline" && value === "" ? null : value;
        values.push(normalized);
        sets.push(`${COLUMNS[field]} = $${values.length}`);
    }

    sets.push("updated_at = now()");

    values.push(id);
    const idParam = values.length;

    values.push(DEMO_USER_ID);
    const userParam = values.length;

    const { rows } = await query(
        `UPDATE applications
        SET ${sets.join(", ")}
        WHERE id = $${idParam} AND user_id = $${userParam}
        RETURNING id,  company, role, jd_url, location, remote,
                deadline::text AS deadline, status, notes`,
        values,
    );

    if (rows.length === 0) {
        return res.status(404).json({ error: "Application not found" });
    }

    return res.json(toApi(rows[0]));
});

app.delete("/applications/:id", async (req, res) => {
    const id = parseId(req.params.id);

    if (id === null) {
        return res.status(400).json({ error: "Invalid id" });
    }

    const { rows } = await query(
        `DELETE FROM applications
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
        [id, DEMO_USER_ID],
    );

    if (rows.length === 0) {
        return res.status(404).json({ error: "Application not found" });
    }

    return res.status(204).end()
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