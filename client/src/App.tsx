import { ApplicationForm } from "./components/ApplicationForm";
import { ApplicationList } from "./components/ApplicationList";
import { Filters } from "./components/Filters";
import { useEffect, useState } from "react";
import {
    createApplication,
    deleteApplication,
    getApplications,
    updateApplication,
} from "./api/applications";
import type {
    Application,
    ApplicationStatus,
    NewApplication,
    SortOption,
    StatusFilter,
} from "./types";

import { LoginPage } from "./components/LoginPage";
import { getMe } from "./api/auth";
import { ApiError } from "./api/client";
import { clearToken, getToken } from "./auth/token";
import type { User } from "./types";

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [checkingAuth, setCheckingAuth] = useState<boolean>(() => Boolean(getToken()));
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortBy, setSortBy] = useState<SortOption>("deadline");

    useEffect(() => {
        if (!getToken()) {
            return;
        }

        getMe()
            .then(setUser)
            .catch(() => clearToken())
            .finally(() => setCheckingAuth(false));
    }, []);

    useEffect(() => {
        if (!user) return;

        let cancelled = false;

        async function load() {
            try {
                const data = await getApplications();
                if (!cancelled) {
                    setApplications(data);
                    setError(null);
                }
            } catch (err) {
                if (cancelled) return;

                if (err instanceof ApiError && err.status === 401) {
                    clearToken();
                    setUser(null);
                    setApplications([]);
                    return;
                }

                setError("Could not load applications.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [user]);

    function handleLogout() {
        clearToken();
        setUser(null);
        setApplications([]);
    }

    if (checkingAuth) {
        return <p className="loading">Checking seasion...</p>;
    }

    if (!user) {
        return <LoginPage onAuthenticated={setUser} />;
    }

    async function handleCreate(application: NewApplication): Promise<boolean> {
        setError(null);

        try {
            const created = await createApplication(application);
            setApplications((previous) => [...previous, created]);
            return true;
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                handleLogout();
                return false;
            }
            setError("Could not create application.");
            return false;
        }
    }
    async function handleStatusChange(id: string, status: ApplicationStatus): Promise<boolean> {
        setError(null);

        try {
            const updated = await updateApplication(id, { status });
            setApplications((previous) =>
                previous.map((application) =>
                    application.id === id ? updated : application,
                ),
            );
            return true;
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                handleLogout();
                return false;
            }
            setError("Could not create application.");
            return false;
        }
    }


    async function handleDelete(application: Application): Promise<boolean> {
        setError(null);

        try {
            await deleteApplication(application.id);
            setApplications((previous) =>
                previous.filter((item) => item.id !== application.id),
            );
            return true;
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                handleLogout();
                return false;
            }
            setError("Could not delete application.");
            return false;
        }
    }

    const visible = applications
        .filter(
            (application) =>
                statusFilter === "all" || application.status === statusFilter,
        )
        .sort((a, b) => {
            if (sortBy === "company") return a.company.localeCompare(b.company);
            return a.deadline.localeCompare(b.deadline);
        });

    return (
        <>
            <header className="header">
                <h1>Internship Tracker</h1>
                <p>Keep every application, deadline, and next step in one place.</p>
                <div className="user-bar">
                    <span>Signed in as <strong>{user.name}</strong></span>
                    <button type="button" onClick={handleLogout}>Sign out</button>
                </div>
            </header>

            <main className="container">
                <ApplicationForm onCreate={handleCreate} />

                <section className="card">
                    <Filters
                        status={statusFilter}
                        sortBy={sortBy}
                        onStatusChange={setStatusFilter}
                        onSortChange={setSortBy}
                    />


                    {error && <p className="error" role="alert">{error}</p>}
                    {loading && (
                        <p className="loading" role="status">
                            Loading applications...
                        </p>
                    )}

                    {!loading && !error && visible.length === 0 && (
                        <p className="empty">
                            {applications.length === 0
                                ? "No applications yet. Add your first one."
                                : "No applications match this filter."}
                        </p>
                    )}

                    {!loading && (
                        <ApplicationList
                            applications={visible}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                        />
                    )}
                </section>
            </main>
        </>
    );
}

export default App;