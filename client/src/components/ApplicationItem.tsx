import { STATUS_LABELS } from "../constants";
import { STATUSES } from "../types";
import type { Application, ApplicationStatus } from "../types";
import { formatDeadline, safeUrl } from "../utils/format";

interface ApplicationItemProps {
    application: Application;
    onStatusChange: (id: string, status: ApplicationStatus) => void;
    onDelete: (id: string) => void;
}

export function ApplicationItem({
    application,
    onStatusChange,
    onDelete,
}: ApplicationItemProps) {
    const jdUrl = safeUrl(application.jdUrl);

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
                    onChange={(event) =>
                        onStatusChange(
                            application.id,
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
                    onClick={() => onDelete(application.id)}
                >
                    Delete
                </button>
            </div>
        </li>
    );
}
