import { useState } from "react";
import type { FormEvent } from "react";
import { STATUS_LABELS } from "../constants";
import { STATUSES } from "../types";
import type { ApplicationStatus, NewApplication } from "../types";

const EMPTY_FORM: NewApplication = {
    company: "",
    role: "",
    jdUrl: "",
    location: "",
    remote: false,
    deadline: "",
    status: "applied",
    notes: "",
};

interface ApplicationFormProps {
    onCreate: (application: NewApplication) => boolean;
}

export function ApplicationForm({ onCreate }: ApplicationFormProps) {
    const [form, setForm] = useState<NewApplication>(EMPTY_FORM);

    function updateField<K extends keyof NewApplication>(
        key: K,
        value: NewApplication[K],
    ) {
        setForm((previous) => ({ ...previous, [key]: value }));
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const created = onCreate({
            ...form,
            company: form.company.trim(),
            role: form.role.trim(),
            jdUrl: form.jdUrl.trim(),
            location: form.location.trim(),
            notes: form.notes.trim(),
        });

        if (created) {
            setForm(EMPTY_FORM);
        }
    }

    return (
        <section className="card">
            <h2>Add Application</h2>

            <form id="application-form" onSubmit={handleSubmit}>
                <div className="grid">
                    <label>
                        Company
                        <input
                            value={form.company}
                            onChange={(event) => updateField("company", event.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Role
                        <input
                            value={form.role}
                            onChange={(event) => updateField("role", event.target.value)}
                            required
                        />
                    </label>

                    <label>
                        JD link
                        <input
                            type="url"
                            placeholder="https://..."
                            value={form.jdUrl}
                            onChange={(event) => updateField("jdUrl", event.target.value)}
                        />
                    </label>

                    <label>
                        Location
                        <input
                            placeholder="Singapore / Remote"
                            value={form.location}
                            onChange={(event) => updateField("location", event.target.value)}
                        />
                    </label>

                    <label>
                        Deadline
                        <input
                            type="date"
                            value={form.deadline}
                            onChange={(event) => updateField("deadline", event.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Status
                        <select
                            value={form.status}
                            onChange={(event) => updateField("status", event.target.value as ApplicationStatus)}
                        >
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {STATUS_LABELS[status]}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="notes-label">
                    Notes
                    <textarea
                        rows={2}
                        placeholder="Referral, next step, contact..."
                        value={form.notes}
                        onChange={(event) => updateField("notes", event.target.value)}
                    />
                </label>

                <label className="checkbox">
                    <input
                        type="checkbox"
                        checked={form.remote}
                        onChange={(event) => updateField("remote", event.target.checked)}
                    />
                    Remote
                </label>

                <button type="submit">Add Application</button>
            </form>
        </section>
    );
}