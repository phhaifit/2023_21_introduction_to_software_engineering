type PageHeaderProps = {
  title: string;
  onCreate: () => void;
};

export function PageHeader({ title, onCreate }: PageHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Workflow Management</p>
        <h1>{title}</h1>
      </div>
      <button className="primary-action" type="button" onClick={onCreate}>
        Create Workflow
      </button>
    </header>
  );
}
