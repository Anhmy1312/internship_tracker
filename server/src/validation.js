const { z } = require("zod");

const applicationSchema = z.object({
    company: z.string().min(1).max(200),
    role: z.string().min(1).max(200),
    jdUrl: z.url().or(z.literal("")).default(""),
    location: z.string().max(200).default(""),
    remote: z.boolean().default(false),
    deadline: z.iso.date().or(z.literal("")).default(""),
    status: z.enum(["wishlist", "applied", "interview", "offer", "rejected"]).default("wishlist"),
    notes: z.string().max(2000).default(""),
});

function parseId(value) {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
}

module.exports = { applicationSchema, parseId };