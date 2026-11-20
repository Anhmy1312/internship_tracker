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

function App() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortBy, setSortBy] = useState<SortOption>("deadline");


    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const data = await getApplications();
                if (!cancelled) setApplications(data);
            } catch {
                if (!cancelled) {
                    setError("Could not load applications. Is the API running on port 3000?");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    async function handleCreate(application: NewApplication): Promise<boolean> {
        setError(null);

        try {
            const created = await createApplication(application);
            setApplications((previous) => [...previous, created]);
            return true;
        } catch {
            setError("Could not save application. Please try again.");
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
        } catch {
            setError("Could not update status. Please try again.");
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
        } catch {
            setError("Could not delete application. Please try again.");
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