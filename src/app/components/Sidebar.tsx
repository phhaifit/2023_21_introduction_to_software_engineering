import type { PageKey } from "../App";

const items: Array<{ key: PageKey; label: string; index: string }> = [
  { key: "dashboard", label: "Dashboard", index: "01" },
  { key: "workflows", label: "Workflows", index: "02" },
  { key: "editor", label: "Workflow Editor", index: "03" },
  { key: "executions", label: "Executions", index: "04" },
  { key: "agents", label: "Agents", index: "05" },
  { key: "settings", label: "Settings", index: "06" },
];

type SidebarProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
};

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">W</div>
        <p className="brand-name">Workflow Manager</p>
      </div>
      <nav className="nav-list">
        {items.map((item) => {
          const isActive = item.key === activePage;
          return (
            <button
              className={`nav-item${isActive ? " active" : ""}`}
              type="button"
              aria-current={isActive ? "page" : undefined}
              key={item.key}
              onClick={() => onNavigate(item.key)}
            >
              <span className="nav-icon" aria-hidden="true">{item.index}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
