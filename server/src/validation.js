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

const applicationPatchSchema = z.object({
    company: z.string().min(1).max(200).optional(),
    role: z.string().min(1).max(200).optional(),
    jdUrl: z.url().or(z.literal("")).optional(),
    location: z.string().max(200).optional(),
    remote: z.boolean().optional(),
    deadline: z.iso.date().or(z.literal("")).optional(),
    status: z.enum(["wishlist", "applied", "interview", "offer", "rejected"]).optional(),
    notes: z.string().max(2000).optional(),
});

const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(8).max(72),
    name: z.string().trim().min(1).max(100),
});

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1).max(72),
});

function parseId(value) {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
}

module.exports = {
    applicationSchema,
    applicationPatchSchema,
    registerSchema,
    loginSchema,
    parseId
};