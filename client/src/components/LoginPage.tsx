import { useState } from "react";
import type { FormEvent } from "react";
import { login, register } from "../api/auth";
import { ApiError } from "../api/client";
import { setToken } from "../auth/token";
import type { User } from "../types";

interface LoginPageProps {
    onAuthenticated: (user: User) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;

        setError(null);
        setBusy(true);

        try {
            const result = mode === "login"
                ? await login(email.trim(), password)
                : await register(email.trim(), password, name.trim());

            setToken(result.token);
            onAuthenticated(result.user);
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                setError("Email hoặc mật khẩu không đúng.");
            } else if (err instanceof ApiError && err.status === 409) {
                setError("Email này đã được đăng ký.");
            } else {
                setError("Không kết nối được với API. Kiểm tra server đang chạy.");
            }
        } finally {
            setBusy(false);
        }
    }

    function switchMode() {
        setError(null);
        setMode((current) => (current === "login" ? "register" : "login"));
    }

    return (
        <main className="container">
            <section className="card login-card">
                <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>

                <form onSubmit={handleSubmit}>
                    {mode === "register" && (
                        <label>
                            Name
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                required
                                maxLength={100}
                                autoComplete="name"
                            />
                        </label>
                    )}

                    <label>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                        />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            minLength={mode === "register" ? 8 : 1}
                            maxLength={72}
                            autoComplete={
                                mode === "login"
                                    ? "current-password"
                                    : "new-password"
                            }
                        />
                    </label>

                    {error && (
                        <p className="error" role="alert">
                            {error}
                        </p>
                    )}

                    <button type="submit" disabled={busy}>
                        {busy
                            ? "Please wait..."
                            : mode === "login"
                                ? "Sign in"
                                : "Create account"
                        }
                    </button>
                </form>

                <button type="button" className="link-btn" onClick={switchMode}>
                    {mode === "login"
                        ? "No account yet? Create one"
                        : "Already have an account? Sign in"
                    }
                </button>
            </section>
        </main>
    );
}