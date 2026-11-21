import { useState } from "react";
import { STATUS_LABELS } from "../constants";
import { STATUSES } from "../types";
import type { Application, ApplicationStatus } from "../types";
import { formatDeadline, safeUrl } from "../utils/format";

interface ApplicationItemProps {
    application: Application;
    onStatusChange: (id: string, status: ApplicationStatus) => Promise<boolean>;
    onDelete: (application: Application) => Promise<boolean>;
}

export function ApplicationItem({
    application,
    onStatusChange,
    onDelete,
}: ApplicationItemProps) {
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const jdUrl = safeUrl(application.jdUrl);

    async function handleStatusChange(status: ApplicationStatus) {
        setUpdating(true);
        try {
            await onStatusChange(application.id, status);
        } finally {
            setUpdating(false);
        }
    }

    async function handleDelete() {
        const confirmed = window.confirm(
            `Delete ${application.company} — ${application.role}?`,
        );
        if (!confirmed) return;

        setDeleting(true);
        try {
            await onDelete(application);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <li className="application">
            <div className="application-main">
                <h3 className="company">{application.company}</h3>
                <p className="role">{application.role}</p>
                <p className="meta">
                    <span className="location">
                        {application.location || "Location TBD"}
                    </span>
                    <span className="remote">
                        {application.remote ? "Remote" : "On-site"}
                    </span>
                    <span className="deadline">
                        Deadline: {formatDeadline(application.deadline)}
                    </span>
                    {jdUrl && (
                        <a
                            className="jd-link"
                            href={jdUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            JD
                        </a>
                    )}
                </p>
                <p className="notes">{application.notes}</p>
            </div>

            <div className="application-actions">
                <select
                    className="status-select"
                    aria-label="Application status"
                    value={application.status}
                    disabled={updating}
                    onChange={(event) =>
                        handleStatusChange(
                            event.target.value as ApplicationStatus,
                        )
                    }
                >
                    {STATUSES.map((status) => (
                        <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                        </option>
                    ))}
                </select>

                <button
                    className="delete-btn"
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                >
                    {deleting ? "Deleting..." : "Delete"}
                </button>
            </div>
        </li>
    );
}
