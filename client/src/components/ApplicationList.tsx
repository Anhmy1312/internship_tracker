import type { Application } from "../types";
import { ApplicationItem } from "./ApplicationItem";

interface ApplicationListProps {
    applications: Application[];
}

export function ApplicationList({ applications }: ApplicationListProps) {
    return (
        <ul className="application-list">
            {applications.map((application) => (
                <ApplicationItem key={application.id} application={application} />
            ))}
        </ul>
    );
}