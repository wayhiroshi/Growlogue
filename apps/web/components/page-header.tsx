import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  action
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__top">
        <span className="page-header__icon" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        {action ? <div className="page-header__action">{action}</div> : null}
      </div>
      {description ? <p className="page-header__description">{description}</p> : null}
    </header>
  );
}
