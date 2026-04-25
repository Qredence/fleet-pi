"use client";

import { cn } from "../utils/cn";
import type { ReactNode } from "react";

export type SuggestionItem = {
  id: string;
  label: string;
  value?: string;
  icon?: ReactNode;
  className?: string;
};

export type SuggestionsProps = {
  items: Array<SuggestionItem>;
  onSelect: (item: SuggestionItem) => void;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
};

export function Suggestions({
  items,
  onSelect,
  disabled,
  className,
  itemClassName,
}: SuggestionsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(item)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-transparent px-2 text-sm text-an-foreground-muted transition-colors hover:bg-an-background-secondary/40 hover:text-an-foreground disabled:opacity-50 disabled:pointer-events-none",
            itemClassName,
            item.className,
          )}
        >
          {item.icon && (
            <span className="inline-flex shrink-0">{item.icon}</span>
          )}
          {item.label}
        </button>
      ))}
    </div>
  );
}
