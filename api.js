const API_URL = "http://localhost:3001/applications";

async function request(url, options = {}) {
    const headers = { ...options.headers };
    if (options.body) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export function getApplications() {
    return request(API_URL);
}

export function createApplication(application) {
    return request(API_URL, {
        method: "POST",
        body: JSON.stringify(application),
    });
}

export function updateApplication(id, patch) {
    return request(`${API_URL}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
}

export function deleteApplication(id) {
    return request(`${API_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}