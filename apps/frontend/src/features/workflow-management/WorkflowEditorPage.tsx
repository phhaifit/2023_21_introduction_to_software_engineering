import { useState } from "react";
import { ConfirmButton } from "../../components/shared/ConfirmButton";

export function WorkflowEditorPage() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "Draft",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="panel form-panel">
      <h2>Thông tin Workflow</h2>
      <div className="form-group">
        <label className="form-label" htmlFor="name">Tên Workflow</label>
        <input
          id="name"
          name="name"
          type="text"
          className="form-input"
          placeholder="Nhập tên workflow..."
          value={formData.name}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="description">Mô tả</label>
        <textarea
          id="description"
          name="description"
          className="form-input"
          placeholder="Nhập mô tả workflow..."
          rows={4}
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="status">Trạng thái</label>
        <select
          id="status"
          name="status"
          className="form-input"
          value={formData.status}
          onChange={handleChange}
        >
          <option value="Draft">Bản nháp (Draft)</option>
          <option value="Published">Đã xuất bản (Published)</option>
        </select>
      </div>

      <div className="form-actions">
        <button className="secondary-action">Hủy bỏ</button>
        <ConfirmButton
          onConfirm={async () => {
            console.log("Saved", formData);
          }}
          label="Lưu thay đổi"
          confirmTitle="Xác nhận lưu"
          confirmMessage={`Bạn có chắc chắn muốn lưu workflow "${formData.name || 'chưa đặt tên'}" không?`}
        />
      </div>
    </div>
  );
}
