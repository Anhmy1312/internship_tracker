import { getToken } from "../auth/token";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/applications";

export const API_BASE = API_URL.replace(/\/applications\/?$/, "");

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export async function request<T>(
    url: string,
    options: RequestInit = {},
): Promise<T> {
    const headers = new Headers(options.headers);

    if (options.body) {
        headers.set("Content-Type", "application/json");
    }

    const token = getToken();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        let message = `Request failed: ${response.status}`;

        try {
            const body = await response.json();
            if (typeof body?.error === "string") message = body.error;
        } catch {
            // body khong phai json
        }

        throw new ApiError(response.status, message);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}