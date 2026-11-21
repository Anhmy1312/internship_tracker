import { STATUS_LABELS } from "../constants";
import { STATUSES } from "../types";
import type { SortOption, StatusFilter } from "../types";

interface FiltersProps {
    status: StatusFilter;
    sortBy: SortOption;
    onStatusChange: (status: StatusFilter) => void;
    onSortChange: (sort: SortOption) => void;
}

export function Filters({
    status,
    sortBy,
    onStatusChange,
    onSortChange,
}: FiltersProps) {
    return (
        <div className="toolbar">
            <h2>Applications</h2>

            <div className="filters">
                <label>
                    Filter
                    <select
                        value={status}
                        onChange={(event) =>
                            onStatusChange(event.target.value as StatusFilter)
                        }
                    >
                        <option value="all">All</option>
                        {STATUSES.map((item) => (
                            <option key={item} value={item}>
                                {STATUS_LABELS[item]}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Sort by
                    <select
                        value={sortBy}
                        onChange={(event) =>
                            onSortChange(event.target.value as SortOption)
                        }
                    >
                        <option value="deadline">Deadline</option>
                        <option value="company">Company</option>
                    </select>
                </label>
            </div>
        </div>
    );
}
