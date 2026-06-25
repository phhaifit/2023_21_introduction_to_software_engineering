import { useState, type ComponentType } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GitBranch,
  HelpCircle,
  Home,
  Library,
  ListChecks,
  Settings
} from "lucide-react";

import type { PageKey } from "../../types/navigation";

type NavigationItem = {
  key: PageKey;
  label: string;
  ariaLabel?: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const primaryItems: NavigationItem[] = [
  { key: "dashboard", label: "Home", icon: Home },
  { key: "executions", label: "Tasks", ariaLabel: "Công việc", icon: ListChecks }
];

const buildItems: NavigationItem[] = [
  { key: "agents", label: "Agents", icon: Bot },
  { key: "workflows", label: "Workflow", icon: GitBranch },
  { key: "knowledge-base-rag", label: "Knowledge", icon: Library }
];

const footerItems: NavigationItem[] = [
  { key: "billing", label: "Subscriptions & Billing", icon: CreditCard },
  { key: "settings", label: "Settings", icon: Settings }
];

type SidebarProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
};

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarClass = `sidebar${isCollapsed ? " sidebar--collapsed" : ""}`;
  const toggleLabel = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const ToggleIcon = isCollapsed ? ChevronRight : ChevronLeft;

  return (
    <aside className={sidebarClass} aria-label="Primary navigation" data-collapsed={isCollapsed}>
      <div className="sidebar__workspace">
        <button className="workspace-switcher" type="button" aria-label="Current workspace Tunha">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span className="workspace-switcher__text">
            <span className="brand-name">Tunha</span>
            <span className="workspace-switcher__subtitle">VCP Platform</span>
          </span>
        </button>
        <button
          className="sidebar__toggle"
          type="button"
          aria-label={toggleLabel}
          aria-pressed={isCollapsed}
          onClick={() => setIsCollapsed((current) => !current)}
        >
          <ToggleIcon size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="nav-list" aria-label="Workspace navigation">
        <NavigationGroup items={primaryItems} activePage={activePage} onNavigate={onNavigate} />
        <div className="nav-section-label">Build</div>
        <NavigationGroup items={buildItems} activePage={activePage} onNavigate={onNavigate} />
      </nav>

      <nav className="nav-list nav-list--footer" aria-label="Workspace settings">
        <NavigationGroup items={footerItems} activePage={activePage} onNavigate={onNavigate} />
        <button className="nav-item nav-item--help" type="button" aria-label="Ask for help">
          <span className="nav-icon" aria-hidden="true">
            <HelpCircle size={19} strokeWidth={2.2} />
          </span>
          <span className="nav-label">Ask for help</span>
        </button>
      </nav>
    </aside>
  );
}

type NavigationGroupProps = {
  items: readonly NavigationItem[];
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
};

function NavigationGroup({ items, activePage, onNavigate }: NavigationGroupProps) {
  return (
    <>
      {items.map((item) => {
        const isActive = item.key === activePage;
        const Icon = item.icon;

        return (
          <button
            className={`nav-item${isActive ? " active" : ""}`}
            type="button"
            aria-current={isActive ? "page" : undefined}
            aria-label={item.ariaLabel ?? item.label}
            key={item.key}
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon" aria-hidden="true">
              <Icon size={19} strokeWidth={2.2} />
            </span>
            <span className="nav-label">{item.label}</span>
            {item.key === "agents" && isActive ? (
              <span className="nav-active-dot" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </>
  );
}
