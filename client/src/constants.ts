import type { ApplicationStatus } from "./types";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
    wishlist: "Withlist",
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
};
