require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        "DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.",
    );
}

const useSsl = connectionString.includes("sslmode=require");

const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error", error);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
};
