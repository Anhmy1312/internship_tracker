import { API_BASE, request } from "./client";
import type { AuthResponse, User } from "../types";

export function login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>(`${API_BASE}/auth/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export function register(email: string, password: string, name: string): Promise<AuthResponse> {
    return request<AuthResponse>(`${API_BASE}/auth/register`, {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
    });
}

export async function getMe(): Promise<User> {
    const result = await request<{ user: User }>(`${API_BASE}/auth/me`);
    return result.user;
}