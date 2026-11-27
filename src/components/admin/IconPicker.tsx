import { DynamicIcon, ICON_OPTIONS, type IconName } from '../DynamicIcon';

interface IconPickerProps {
  label?: string;
  value: IconName;
  onChange: (icon: IconName) => void;
}

export function IconPicker({ label, value, onChange }: IconPickerProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ICON_OPTIONS.map((opt) => {
          const active = opt.name === value;
          return (
            <button
              key={opt.name}
              type="button"
              title={opt.label}
              onClick={() => onChange(opt.name)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-950'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/50'
              }`}
            >
              <DynamicIcon name={opt.name} className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
