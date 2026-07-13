import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Check, Circle } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "icon";
  status?: "idle" | "loading" | "success" | "error";
}

export function Button({ className = "", variant = "secondary", status = "idle", children, ...props }: ButtonProps) {
  return (
    <button className={`ui-button ui-button-${variant} ui-button-${status} ${className}`} {...props}>
      {children}
    </button>
  );
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "article" | "div";
}

export function Card({ as: Element = "section", className = "", children, ...props }: CardProps) {
  return (
    <Element className={`ui-card ${className}`} {...props}>
      {children}
    </Element>
  );
}

interface TabsProps {
  value: string;
  tabs: Array<{ value: string; label: string; count?: number }>;
  onChange(value: string): void;
}

export function Tabs({ value, tabs, onChange }: TabsProps) {
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={value === tab.value ? "active" : ""}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span aria-hidden="true">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

interface SelectCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick(): void;
}

export function SelectCard({ icon, title, description, selected, onClick }: SelectCardProps) {
  return (
    <button type="button" className={selected ? "select-card selected" : "select-card"} onClick={onClick}>
      <div className="select-card-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="select-indicator" aria-hidden="true">
        {selected ? <Check size={14} /> : <Circle size={12} />}
      </div>
    </button>
  );
}

interface ModelItemProps {
  title: string;
  vendor: string;
  capability: string;
  selected: boolean;
  tag?: string;
  meta?: string;
  onClick(): void;
}

export function ModelItem({ title, vendor, capability, selected, tag, meta, onClick }: ModelItemProps) {
  return (
    <button type="button" className={selected ? "model-item selected" : "model-item"} onClick={onClick}>
      <div className="model-item-main">
        <strong>{title}</strong>
        <span>{vendor}</span>
      </div>
      <div className="model-item-meta">
        <span>{capability}</span>
        {meta && <span>{meta}</span>}
        {tag && <em>{tag}</em>}
      </div>
      <div className="select-indicator" aria-hidden="true">
        {selected ? <Check size={14} /> : <Circle size={12} />}
      </div>
    </button>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
