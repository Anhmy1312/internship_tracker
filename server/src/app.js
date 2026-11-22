const express = require("express");
const cors = require("cors");
const { query } = require("./db");
const { applicationSchema,
    applicationPatchSchema,
    registerSchema,
    loginSchema,
    parseId,
} = require("./validation");

const {
    hashPassword,
    verifyPassword,
    signToken,
    requireAuth,
} = require("./auth");

const API_VERSION = process.env.API_VERSION || "0.1.0";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

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

function toUser(row) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
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

app.post("/auth/register", async (req, res) => {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid input",
            details: result.error.issues.map((issues) => ({
                path: issues.path,
                message: issues.message,
            })),
        });
    }

    const email = result.data.email.trim().toLowerCase();
    const name = result.data.name.trim();
    const passwordHash = await hashPassword(result.data.password);

    const { rows } = await query(
        `INSERT INTO users (email, password_hash, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, name`,
        [email, passwordHash, name],
    );

    if (rows.length === 0) {
        return res.status(409).json({ error: "Email already registered" });
    }

    const user = toUser(rows[0]);
    return res.status(201).json({ token: signToken(user.id), user });
});

app.post("/auth/login", async (req, res) => {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid input",
            details: result.error.issues.map((issues) => ({
                path: issues.path,
                message: issues.message,
            })),
        });
    }

    const email = result.data.email.trim().toLowerCase();
    const { rows } = await query(
        `SELECT id, email, name, password_hash
        FROM users
        WHERE email = $1`,
        [email],
    );

    const row = rows[0];
    const passwordOk = await verifyPassword(
        result.data.password,
        row ? row.password_hash : DUMMY_HASH,
    );

    if (!row || !passwordOk) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = toUser(row);
    return res.status(200).json({ token: signToken(user.id), user });
});

app.get("/auth/me", requireAuth, async (req, res) => {
    const { rows } = await query(
        `SELECT id, email, name
        FROM users 
        WHERE id = $1`,
        [req.user.id],
    );

    if (rows.length === 0) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json({ user: toUser(rows[0]) });
});

app.use("/applications", requireAuth);

app.get("/applications", async (req, res) => {
    const { rows } = await query(
        `SELECT id, company, role, jd_url, location, remote,
            deadline::text AS deadline, status, notes
        FROM applications
        WHERE user_id = $1
        ORDER BY deadline ASC NULLS LAST, created_at DESC`,
        [req.user.id],
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
        [id, req.user.id],
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
            req.user.id,
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

    values.push(req.user.id);
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
        [id, req.user.id],
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