import type { Application, ApplicationStatus } from "../types";
import { ApplicationItem } from "./ApplicationItem";

interface ApplicationListProps {
    applications: Application[];
    onStatusChange: (id: string, status: ApplicationStatus) => Promise<boolean>;
    onDelete: (application: Application) => Promise<boolean>;
}

export function ApplicationList({
    applications,
    onStatusChange,
    onDelete,
}: ApplicationListProps) {
    return (
        <ul className="application-list">
            {applications.map((application) => (
                <ApplicationItem
                    key={application.id}
                    application={application}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                />
            ))}
        </ul>
    );
}
