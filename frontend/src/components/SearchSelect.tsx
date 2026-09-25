import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, ChevronDown, X } from "lucide-react";
import { cn } from "../lib/cn";

export interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  /** Optional: called when the query input changes (for server-side search). */
  onQueryChange?: (q: string) => void;
}

/**
 * A searchable single-select combobox — type to filter, click to pick.
 * Replaces a plain <select> when the option list is long (e.g. patients).
 */
export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  required,
  onQueryChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.sublabel?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 50);
  }, [options, query]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "input flex w-full items-center justify-between text-left",
          !selected && "text-slate-400"
        )}
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {selected && (
            <X
              className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </span>
      </button>

      {/* Hidden input to trigger native required validation */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="relative border-b border-slate-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              className="w-full rounded-lg border-0 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="Type to search…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onQueryChange?.(e.target.value);
              }}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50",
                    o.value === value && "bg-brand/5"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy">
                      {o.label}
                    </span>
                    {o.sublabel && (
                      <span className="block truncate text-xs text-slate-400">
                        {o.sublabel}
                      </span>
                    )}
                  </span>
                  {o.value === value && (
                    <Check className="h-4 w-4 flex-shrink-0 text-brand" />
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-400">
                {emptyText}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
