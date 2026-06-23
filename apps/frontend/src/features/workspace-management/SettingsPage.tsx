import { PageHeader } from "../../components/layout/PageHeader";

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" eyebrow="Workspace Management" />
      <article className="empty-state">
        <span className="empty-label">Workflow Settings</span>
        <h2>Settings shell</h2>
        <p>Notification and auto-save preferences will be configured here.</p>
      </article>
    </div>
  );
}
