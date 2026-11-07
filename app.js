const STORAGE_KEY = "internship-tracker-v1";

const form = document.querySelector("#application-form");
const list = document.querySelector("#application-list");
const emptyState = document.querySelector("#empty-state");
const filterStatus = document.querySelector("#filter-status");
const sortBy = document.querySelector("#sort-by");
const template = document.querySelector("#application-template");

let applications = loadApplications();

function loadApplications() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Cuold not load applications:", error);
        return [];
    }
}

function saveApplications() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
}

function formatDeadline(value) {
    if (!value) return "No deadline";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return "";
        return url.href;
    } catch {
        return "";
    }
}

function render() {
    const selectedStatus = filterStatus.value;
    const selectedSort = sortBy.value;

    const visible = applications
        .filter((app) => selectedStatus === "all" || app.status === selectedStatus)
        .sort((a, b) => {
            if (selectedSort === "company") {
                return a.company.localeCompare(b.company);
            }
            return a.deadline.localeCompare(b.deadline);
        })

    list.innerHTML = "";

    if (visible.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent =
            applications.length === 0
                ? "No applications yet. Add your first one."
                : "No applications match this filter.";
        return;
    }

    emptyState.hidden = true;

    for (const app of visible) {
        const node = template.content.cloneNode(true);

        node.querySelector(".company").textContent = app.company;
        node.querySelector(".role").textContent = app.role;
        node.querySelector(".location").textContent = app.location || "Location TBD";
        node.querySelector(".remote").textContent = app.remote ? "Remote" : "On-site";
        node.querySelector(".deadline").textContent = `Deadline: ${formatDeadline(app.deadline)}`;
        node.querySelector(".notes").textContent = app.notes || "";

        const jdLink = node.querySelector(".jd-link");
        const jdUrl = safeUrl(app.jdUrl);
        if (jdUrl) {
            jdLink.href = jdUrl;
        }
        else {
            jdLink.remove();
        }

        const statusSelect = node.querySelector(".status-select");
        statusSelect.value = app.status;
        statusSelect.addEventListener("change", () => {
            app.status = statusSelect.value;
            saveApplications();
            render();
        });

        const deleteButton = node.querySelector(".delete-btn");
        deleteButton.addEventListener("click", () => {
            const confirmed = confirm(`Delete ${app.company} — ${app.role}?`);
            if (!confirmed) return;

            applications = applications.filter((item) => item.id !== app.id);
            saveApplications();
            render();
        })
        list.appendChild(node);
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(form));

    const newApplication = {
        id: Date.now.toString(36) + Math.random().toString(36).slice(2, 8),
        company: data.company.trim(),
        role: data.role.trim(),
        jdUrl: data.jdUrl.trim(),
        location: data.location.trim(),
        remote: data.remote === "on",
        deadline: data.deadline,
        status: data.status,
        notes: data.notes.trim(),
    };

    applications.push(newApplication);
    saveApplications();
    form.reset();
    render();
    form.querySelector("#company").focus();
});

filterStatus.addEventListener("changer", render);
sortBy.addEventListener("change", render);

render();