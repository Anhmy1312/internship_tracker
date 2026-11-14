import type { Application, NewApplication } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/applications";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);

    if (options.body) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}

export function getApplications(): Promise<Application[]> {
    return request<Application[]>(API_URL);
}

export function createApplication(
    application: NewApplication,
): Promise<Application> {
    return request<Application>(API_URL, {
        method: "POST",
        body: JSON.stringify(application),
    });
}

export function updateApplication(
    id: string,
    patch: Partial<NewApplication>,
): Promise<Application> {
    return request<Application>(`${API_URL}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
}

export function deleteApplication(id: string): Promise<void> {
    return request<void>(`${API_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}