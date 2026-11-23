const TOKEN_KEY = "it_token";

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    return localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    return localStorage.removeItem(TOKEN_KEY);
}
