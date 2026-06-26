import { useState, useMemo } from "react";
import type { TaskPresentationStatus } from "../model/task-types";

export interface TaskConversationNavigationItem {
  readonly conversationId: string;
  readonly title: string;
  readonly latestStatus?: TaskPresentationStatus;
  readonly tasks?: readonly {
    readonly taskId: string;
    readonly workId?: string;
    readonly prompt: string;
  }[];
}

export interface TaskConversationNavigationProps {
  readonly items: readonly TaskConversationNavigationItem[];
  readonly activeConversationId?: string;
  readonly onCreateConversation: () => void;
  readonly onSelectConversation: (conversationId: string) => void;
}

const STATUS_LABELS: Readonly<Record<TaskPresentationStatus, string>> = {
  pending: "Pending",
  "in-progress": "In progress",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

export function TaskConversationNavigation({
  items,
  activeConversationId,
  onCreateConversation,
  onSelectConversation
}: TaskConversationNavigationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all") {
        if (item.latestStatus !== statusFilter) {
          return false;
        }
      }
      if (query) {
        const titleMatch = item.title.toLowerCase().includes(query);
        if (titleMatch) {
          return true;
        }
        if (item.tasks) {
          const taskMatch = item.tasks.some(
            (t) =>
              t.prompt.toLowerCase().includes(query) ||
              t.taskId.toLowerCase().includes(query) ||
              (t.workId && t.workId.toLowerCase().includes(query))
          );
          if (taskMatch) {
            return true;
          }
        }
        return false;
      }
      return true;
    });
  }, [items, searchQuery, statusFilter]);

  const activeIsFilteredOut =
    activeConversationId &&
    items.some((item) => item.conversationId === activeConversationId) &&
    !filteredItems.some((item) => item.conversationId === activeConversationId);

  return (
    <nav className="task-conversation-navigation" aria-label="Conversations">
      <div className="task-conversation-navigation__header">
        <button
          type="button"
          className="task-conversation-navigation__new-btn"
          onClick={onCreateConversation}
        >
          New chat
        </button>
      </div>

      <div className="task-conversation-navigation__filters" aria-label="Conversation filters">
        <div className="task-conversation-navigation__search-group">
          <label htmlFor="conversation-search" className="sr-only">Search conversations</label>
          <input
            id="conversation-search"
            type="search"
            className="task-conversation-navigation__search-input"
            placeholder="Search title, prompt, Task/Work ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="task-conversation-navigation__status-group">
          <label htmlFor="conversation-status-filter" className="sr-only">Filter by status</label>
          <select
            id="conversation-status-filter"
            className="task-conversation-navigation__status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
        {(searchQuery.trim() !== "" || statusFilter !== "all") && (
          <button
            type="button"
            className="task-conversation-navigation__clear-filters-btn"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <section className="task-conversation-navigation__list-container" aria-labelledby="recent-work-title">
        <h3 id="recent-work-title">Recent work</h3>
        {filteredItems.length === 0 ? (
          <p className="task-conversation-navigation__empty" aria-live="polite">
            {items.length === 0 ? "No conversations yet" : "No matching conversations found"}
          </p>
        ) : (
          <ul className="task-conversation-navigation__list">
            {filteredItems.map((item) => {
              const isActive = item.conversationId === activeConversationId;
              return (
                <li key={item.conversationId} className="task-conversation-navigation__item">
                  <button
                    type="button"
                    className={`task-conversation-navigation__btn ${isActive ? "task-conversation-navigation__btn--active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onSelectConversation(item.conversationId)}
                  >
                    <span className="task-conversation-navigation__title">{item.title}</span>
                    {item.latestStatus && (
                      <span className={`task-conversation-navigation__status task-conversation-navigation__status--${item.latestStatus}`}>
                        {STATUS_LABELS[item.latestStatus]}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeIsFilteredOut && (
        <div className="task-conversation-navigation__filtered-notice">
          <p>Active conversation is hidden by current filters.</p>
          <button
            type="button"
            className="task-conversation-navigation__restore-btn"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
          >
            Clear filters to view active conversation
          </button>
        </div>
      )}

      <footer className="task-conversation-navigation__notice">
        <p>History data is session-scoped (in-memory).</p>
      </footer>
    </nav>
  );
}
