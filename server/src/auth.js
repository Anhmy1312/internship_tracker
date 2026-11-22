require("dotenv").config({ quiet: true });

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const BCRYPT_COST = 10;

if (!JWT_SECRET) {
    throw new Error(
        "JWT_SECRET is not set. Add it to server/.env (see .env.example).",
    );
}

function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_COST);
}

function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}

function signToken(userId) {
    return jwt.sign({}, JWT_SECRET, {
        subject: String(userId),
        expiresIn: JWT_EXPIRES_IN,
        algorithm: "HS256",
    });
}

function requireAuth(req, res, next) {
    const header = req.get("authorization") || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET, {
            algorithms: ["HS256"],
        });
        const id = Number(payload.sub);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.user = { id };
        return next();
    } catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    signToken,
    requireAuth,
};