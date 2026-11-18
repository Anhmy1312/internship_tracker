require("dotenv").config({ quiet: true });

if (!process.env.DATABASE_URL) {
    console.error(
        "DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.",
    );
    process.exit(1);
}

const { pool } = require("../src/db");

async function main() {
    const result = await pool.query(
        'SELECT current_database() AS database, current_user AS "user", now() AS now',
    );
    console.log(result.rows[0]);
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());