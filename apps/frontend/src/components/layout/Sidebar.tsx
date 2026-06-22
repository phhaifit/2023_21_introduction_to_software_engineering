import type { PageKey } from "../../types/navigation";

const items: Array<{ key: PageKey; label: string; index: string }> = [
  { key: "workflows", label: "Workflows", index: "01" },
  { key: "executions", label: "Công việc", index: "02" },
  { key: "agents", label: "Nhân viên ảo", index: "03" },
  { key: "knowledge-base-rag", label: "Knowledge Base / RAG", index: "04" },
  { key: "billing", label: "Thanh toán", index: "05" },
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
        <div className="brand-mark" aria-hidden="true">V</div>
        <p className="brand-name">VCP Platform</p>
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
