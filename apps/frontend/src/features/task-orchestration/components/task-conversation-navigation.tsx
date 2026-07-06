import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import type { TaskPresentationStatus } from "../model/task-types";

export interface TaskConversationNavigationItem {
  readonly conversationId: string;
  readonly title: string;
  readonly latestStatus?: TaskPresentationStatus;
  readonly updatedAt?: string;
  readonly taskCount?: number;
  readonly canDelete?: boolean;
  readonly deleteDisabledReason?: string;
  readonly tasks?: readonly {
    readonly taskId: string;
    readonly workId?: string;
    readonly prompt: string;
  }[];
}

export interface TaskConversationNavigationProps {
  readonly items: readonly TaskConversationNavigationItem[];
  readonly activeConversationId?: string;
  readonly isCollapsed?: boolean;
  readonly onCreateConversation: () => void;
  readonly onSelectConversation: (conversationId: string) => void;
  readonly onDeleteConversation?: (conversationId: string) => void;
}

const STATUS_LABELS: Readonly<Record<TaskPresentationStatus, string>> = {
  pending: "Pending",
  "in-progress": "In progress",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

function formatShortTimestamp(value?: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function ConversationItemMenu({
  conversationId,
  title,
  canDelete,
  deleteDisabledReason,
  onDelete
}: {
  conversationId: string;
  title: string;
  canDelete?: boolean;
  deleteDisabledReason?: string;
  onDelete?: (conversationId: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const menuLabel = `Delete conversation ${title}`;

  if (!onDelete) {
    return null;
  }

  return (
    <div className="task-conversation-navigation__item-menu">
      <button
        type="button"
        className="task-conversation-navigation__item-menu-btn task-conversation-navigation__delete-btn-direct"
        aria-label={menuLabel}
        title={!canDelete ? deleteDisabledReason : "Delete conversation"}
        disabled={!canDelete}
        onClick={(event) => {
          event.stopPropagation();
          if (canDelete) {
            onDelete(conversationId);
          }
        }}
      >
        <Trash2 aria-hidden="true" size={16} strokeWidth={1.9} />
      </button>
    </div>
  );
}

function ConversationNavigationItem({
  item,
  isActive,
  shortTimestamp,
  onSelectConversation,
  onDeleteConversation
}: {
  item: TaskConversationNavigationItem;
  isActive: boolean;
  shortTimestamp: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
}) {
  return (
    <li
      className="task-conversation-navigation__item"
    >
      <div
        className={`task-conversation-navigation__item-row${
          isActive ? " task-conversation-navigation__item-row--active" : ""
        }`}
      >
        <button
          type="button"
          className="task-conversation-navigation__btn task-conversation-navigation__conversation-button"
          aria-label={item.title}
          aria-current={isActive ? "page" : undefined}
          onClick={() => onSelectConversation(item.conversationId)}
        >
          <span className="task-conversation-navigation__title">{item.title}</span>
          <span className="task-conversation-navigation__meta-row">
            {item.latestStatus ? (
              <span
                className={`task-conversation-navigation__status task-conversation-navigation__status--${item.latestStatus}`}
              >
                {STATUS_LABELS[item.latestStatus]}
              </span>
            ) : null}
            {typeof item.taskCount === "number" && item.taskCount > 0 ? (
              <span className="task-conversation-navigation__task-count">
                {item.taskCount} task{item.taskCount === 1 ? "" : "s"}
              </span>
            ) : null}
            {shortTimestamp ? (
              <span className="task-conversation-navigation__timestamp">{shortTimestamp}</span>
            ) : null}
          </span>
        </button>
        <ConversationItemMenu
          conversationId={item.conversationId}
          title={item.title}
          canDelete={item.canDelete}
          deleteDisabledReason={item.deleteDisabledReason}
          onDelete={onDeleteConversation}
        />
      </div>
    </li>
  );
}

export function TaskConversationNavigation({
  items,
  activeConversationId,
  isCollapsed = false,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation
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
              t.prompt.toLowerCase().includes(query)
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

  const activeItem = items.find((item) => item.conversationId === activeConversationId);

  if (isCollapsed) {
    const activeItemLabel = activeItem
      ? `Active conversation: ${activeItem.title}${
          activeItem.latestStatus ? `, ${STATUS_LABELS[activeItem.latestStatus]}` : ""
        }`
      : "No active conversation";

    return (
      <nav
        className="task-conversation-navigation task-conversation-navigation--collapsed"
        aria-label="Conversations"
      >
        <button
          type="button"
          className="task-conversation-navigation__new-btn task-conversation-navigation__new-btn--compact"
          onClick={onCreateConversation}
          aria-label="New chat"
          title="New chat"
        >
          <Plus aria-hidden="true" size={18} strokeWidth={1.9} />
        </button>
        {activeItem ? (
          <div
            className="task-conversation-navigation__collapsed-active"
            aria-label={activeItemLabel}
            title={activeItem.title}
          >
            <span
              className={`task-conversation-navigation__collapsed-status-dot${
                activeItem.latestStatus
                  ? ` task-conversation-navigation__collapsed-status-dot--${activeItem.latestStatus}`
                  : ""
              }`}
              aria-hidden="true"
            />
            {typeof activeItem.taskCount === "number" && activeItem.taskCount > 0 ? (
              <span
                className="task-conversation-navigation__collapsed-count"
                aria-hidden="true"
              >
                {activeItem.taskCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </nav>
    );
  }

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
          <label htmlFor="conversation-search" className="sr-only">
            Search conversations
          </label>
          <input
            id="conversation-search"
            type="search"
            className="task-conversation-navigation__search-input"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="task-conversation-navigation__status-group">
          <label htmlFor="conversation-status-filter" className="sr-only">
            Filter by status
          </label>
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

      <section
        className="task-conversation-navigation__list-container"
        aria-labelledby="recent-work-title"
      >
        <h3 id="recent-work-title">Recent work</h3>
        {filteredItems.length === 0 ? (
          <p className="task-conversation-navigation__empty" aria-live="polite">
            {items.length === 0 ? "No conversations yet" : "No matches"}
          </p>
        ) : (
          <ul className="task-conversation-navigation__list">
            {filteredItems.map((item) => {
              const isActive = item.conversationId === activeConversationId;
              const shortTimestamp = formatShortTimestamp(item.updatedAt);
              return (
                <ConversationNavigationItem
                  key={item.conversationId}
                  item={item}
                  isActive={isActive}
                  shortTimestamp={shortTimestamp}
                  onSelectConversation={onSelectConversation}
                  onDeleteConversation={onDeleteConversation}
                />
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
    </nav>
  );
}
