import { StatCard } from "../../components/shared/StatCard";
import { StatusBadge } from "../../components/shared/StatusBadge";

const workflows = [
  { name: "Customer Onboarding", status: "Running" as const },
  { name: "Invoice Approval", status: "Completed" as const },
  { name: "Lead Qualification", status: "Draft" as const },
];

export function DashboardPage() {
  return (
    <div>
      <section>
        <div className="stats-grid">
          <StatCard label="Total Workflows" value="18" />
          <StatCard label="Running" value="4" />
          <StatCard label="Completed" value="126" />
          <StatCard label="Failed" value="3" />
        </div>
        <div className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <h2>Recent Workflows</h2>
              <button className="text-action" type="button">View all</button>
            </div>
            {workflows.map((workflow) => (
              <div className="placeholder-row" key={workflow.name}>
                <span>{workflow.name}</span>
                <StatusBadge status={workflow.status} />
              </div>
            ))}
          </article>
          <article className="panel">
            <div className="panel-heading">
              <h2>Quick Actions</h2>
            </div>
            <button className="quick-action" type="button">Create workflow</button>
            <button className="quick-action" type="button">View workflows</button>
            <button className="quick-action" type="button">Monitor executions</button>
          </article>
        </div>
      </section>
    </div>
  );
}
