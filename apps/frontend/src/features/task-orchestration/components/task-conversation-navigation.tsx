import type { TaskPresentationStatus } from "../model/task-types";

export interface TaskConversationNavigationItem {
  readonly conversationId: string;
  readonly title: string;
  readonly latestStatus?: TaskPresentationStatus;
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
      <section className="task-conversation-navigation__list-container" aria-labelledby="recent-work-title">
        <h3 id="recent-work-title">Recent work</h3>
        {items.length === 0 ? (
          <p className="task-conversation-navigation__empty">No conversations yet</p>
        ) : (
          <ul className="task-conversation-navigation__list">
            {items.map((item) => {
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
    </nav>
  );
}
