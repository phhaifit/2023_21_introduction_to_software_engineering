import { StatCard } from "../../components/shared/StatCard";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { mockWorkflows } from "../../data/workflows";

export function DashboardPage() {
  const total = mockWorkflows.length;
  const running = mockWorkflows.filter((w) => w.status === "Running").length;
  const completed = mockWorkflows.filter((w) => w.status === "Completed").length;
  const failed = mockWorkflows.filter((w) => w.status === "Failed").length;

  const recentWorkflows = mockWorkflows.slice(0, 3);

  return (
    <div>
      <section>
        <div className="stats-grid">
          <StatCard label="Total Workflows" value={total.toString()} />
          <StatCard label="Running" value={running.toString()} />
          <StatCard label="Completed" value={completed.toString()} />
          <StatCard label="Failed" value={failed.toString()} />
        </div>
        <div className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <h2>Recent Workflows</h2>
              <button className="text-action" type="button">View all</button>
            </div>
            {recentWorkflows.map((workflow) => (
              <div className="placeholder-row" key={workflow.id}>
                <span>{workflow.name}</span>
                <StatusBadge status={workflow.status as "Running" | "Completed" | "Draft" | "Failed"} />
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
