import type { Application } from "../types";
import { formatDeadline, safeUrl } from "../utils/format";

interface ApplicationItemProps {
    application: Application;
}

export function ApplicationItem({ application }: ApplicationItemProps) {
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
                        Deadline = {formatDeadline(application.deadline)}
                    </span>
                    {jdUrl && (
                        <a className="jd-link" href="{jdUrl}" target="_blank" rel="noopener noreferrer">JD</a>
                    )}
                </p>
                <p className="notes">{application.notes}</p>
            </div>
        </li>
    );
}