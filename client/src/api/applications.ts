import type { Application, NewApplication } from "../types";
import { API_BASE, request } from "./client";

const API_URL = `${API_BASE}/applications`;

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