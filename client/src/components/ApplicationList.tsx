import type { Application, ApplicationStatus } from "../types";
import { ApplicationItem } from "./ApplicationItem";

interface ApplicationListProps {
    applications: Application[];
    onStatusChange: (id: string, status: ApplicationStatus) => void;
    onDelete: (id: string) => void;
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
