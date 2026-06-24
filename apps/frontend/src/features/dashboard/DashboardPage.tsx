import { StatCard } from "../../components/shared/StatCard";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { mockWorkflows } from "../../data/workflows";

export function DashboardPage() {
  const total = mockWorkflows.length;
  const running = mockWorkflows.filter((w) => w.lastExecutionStatus === "Running").length;
  const completed = mockWorkflows.filter((w) => w.lastExecutionStatus === "Success" || w.status === "Published").length;
  const failed = mockWorkflows.filter((w) => w.lastExecutionStatus === "Failed").length;

  const recentWorkflows = mockWorkflows.slice(0, 5);

  const mockLogs = [
    { time: "10:24 AM", message: "Data Pipeline Alpha hoàn tất bước Extract.", status: "info" },
    { time: "10:15 AM", message: "Customer Sync Flow bắt đầu thực thi.", status: "info" },
    { time: "09:45 AM", message: "Workflow Inventory Validation gặp lỗi ở bước 2.", status: "error" },
    { time: "09:00 AM", message: "Daily Report Generation đã gửi email báo cáo.", status: "success" },
  ];

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
        
        <div className="content-grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <article className="panel">
              <div className="panel-heading">
                <h2>Workflows hoạt động gần đây</h2>
                <button className="text-action" type="button">Xem tất cả</button>
              </div>
              {recentWorkflows.map((workflow) => (
                <div className="workflow-list-item" key={workflow.workflowId}>
                  <div className="workflow-info">
                    <span className="workflow-name">{workflow.name}</span>
                    <span className="workflow-meta">Cập nhật: {workflow.updatedAt}</span>
                  </div>
                  <StatusBadge status={workflow.lastExecutionStatus || workflow.status} />
                </div>
              ))}
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h2>Tỷ lệ Trạng thái Workflow</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <span>Hoàn thành (Success)</span>
                    <span>{Math.round((completed / total) * 100) || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#eef2f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((completed / total) * 100) || 0}%`, height: '100%', background: '#10b981' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <span>Đang chạy (Running)</span>
                    <span>{Math.round((running / total) * 100) || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#eef2f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((running / total) * 100) || 0}%`, height: '100%', background: '#f59e0b' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <span>Cảnh báo / Lỗi (Failed)</span>
                    <span>{Math.round((failed / total) * 100) || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#eef2f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((failed / total) * 100) || 0}%`, height: '100%', background: '#ef4444' }}></div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <article className="panel" style={{ height: '100%' }}>
            <div className="panel-heading">
              <h2>Nhật ký Hệ thống</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {mockLogs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    marginTop: '6px',
                    background: log.status === 'success' ? '#10b981' : log.status === 'error' ? '#ef4444' : '#6366f1' 
                  }}></div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: '1.4' }}>{log.message}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{log.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="text-action" style={{ width: '100%', marginTop: '24px', textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              Xem toàn bộ lịch sử
            </button>
          </article>

        </div>
      </section>
    </div>
  );
}
