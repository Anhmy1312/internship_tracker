require("dotenv").config({ quiet: true });

if (!process.env.DATABASE_URL) {
    console.error(
        "DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.",
    );
    process.exit(1);
}

const fs = require("fs");
const path = require("path");
const { pool } = require("../src/db");

async function main() {
    const files = ["schema.sql", "seed.sql"];

    for (const file of files) {
        const filePath = path.join(__dirname, "..", "db", file);
        const sql = fs.readFileSync(filePath, "utf8");
        await pool.query(sql);
        console.log(`Applied ${file}`);
    }
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());