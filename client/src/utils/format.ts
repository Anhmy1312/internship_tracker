export function formatDeadline(value: string): string {
    if (!value) return "No deadline";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

export function safeUrl(value: string): string {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return "";
        return url.protocol;
    } catch {
        return "";
    }
}