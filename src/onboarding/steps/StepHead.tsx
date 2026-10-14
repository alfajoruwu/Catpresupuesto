import type { ComponentType, ReactNode } from 'react';

export function StepHead(props: {
  icon: ComponentType<{ size?: number | string }>;
  title: string;
  children: ReactNode;
}): ReactNode {
  const Icon = props.icon;
  return (
    <div className="ob-head">
      <div className="ob-icon" aria-hidden="true">
        <Icon size={28} />
      </div>
      <h2 className="ob-title">{props.title}</h2>
      <div className="ob-text">{props.children}</div>
    </div>
  );
}
