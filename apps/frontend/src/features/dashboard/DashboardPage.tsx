import { StatCard } from "../../components/shared/StatCard";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { mockWorkflows } from "../../data/workflows";

export function DashboardPage() {
  const total = mockWorkflows.length;
  const running = mockWorkflows.filter((w) => w.status === "Running").length;
  const completed = mockWorkflows.filter((w) => w.status === "Completed" || w.status === "Published").length;
  const failed = mockWorkflows.filter((w) => w.status === "Failed").length;

  const recentWorkflows = mockWorkflows.slice(0, 3);

  return (
    <div>
      <section>
        <div className="stats-grid">
          <StatCard 
            title="Tổng số Workflows" 
            value={total.toString()} 
            description="Tất cả quy trình trên hệ thống" 
          />
          <StatCard 
            title="Đang chạy" 
            value={running.toString()} 
            description="Hoạt động ổn định hiện tại" 
          />
          <StatCard 
            title="Hoàn thành" 
            value={completed.toString()} 
            description="Đã thực thi thành công" 
          />
          <StatCard 
            title="Cảnh báo / Lỗi" 
            value={failed.toString()} 
            description="Cần kiểm tra ngay lập tức" 
          />
        </div>
        <div className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <h2>Workflows hoạt động gần đây</h2>
              <button className="text-action" type="button">Xem tất cả</button>
            </div>
            {recentWorkflows.map((workflow) => (
              <div className="placeholder-row" key={workflow.id}>
                <span>{workflow.name}</span>
                <StatusBadge status={workflow.status} />
              </div>
            ))}
          </article>
          <article className="panel">
            <div className="panel-heading">
              <h2>Thao tác nhanh</h2>
            </div>
            <button className="quick-action" type="button">Tạo mới Workflow</button>
            <button className="quick-action" type="button">Xem danh sách Workflows</button>
            <button className="quick-action" type="button">Theo dõi Lịch sử chạy</button>
          </article>
        </div>
      </section>
    </div>
  );
}
