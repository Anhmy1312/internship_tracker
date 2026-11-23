export const STATUSES = [
    "wishlist",
    "applied",
    "interview",
    "offer",
    "rejected",
] as const;

export type ApplicationStatus = (typeof STATUSES)[number];

export interface Application {
    id: string;
    company: string;
    role: string;
    jdUrl: string;
    location: string;
    remote: boolean;
    deadline: string;
    status: ApplicationStatus;
    notes: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export type NewApplication = Omit<Application, "id">;

export type StatusFilter = ApplicationStatus | "all";
export type SortOption = "deadline" | "company";