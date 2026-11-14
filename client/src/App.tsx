import { useState } from "react";
import { ApplicationForm } from "./components/ApplicationForm";
import { ApplicationList } from "./components/ApplicationList";
import { Filters } from "./components/Filters";
import { sampleApplications } from "./data";
import type {
    Application,
    ApplicationStatus,
    NewApplication,
    SortOption,
    StatusFilter,
} from "./types";

function App() {
    const [applications, setApplications] = useState<Application[]>(sampleApplications);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortBy, setSortBy] = useState<SortOption>("deadline");

    function handleCreate(application: NewApplication): boolean {
        const created: Application = {
            ...application,
            id: crypto.randomUUID(),
        };
        setApplications((previous) => [...previous, created]);
        return true;
    }

    function handleStatusChange(id: string, status: ApplicationStatus) {
        setApplications((previous) =>
            previous.map((application) =>
                application.id === id
                    ? { ...application, status }
                    : application,
            ),
        );
    }

    function handleDelete(id: string) {
        setApplications((previous) =>
            previous.filter((application) => application.id !== id),
        );
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

                    {visible.length === 0 && (
                        <p className="empty">
                            {applications.length === 0
                                ? "No applications yet. Add your first one."
                                : "No applications match this filter."
                            }
                        </p>
                    )}

                    <ApplicationList
                        applications={visible}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                    />
                </section>
            </main>
        </>
    );
}

export default App;