interface HubToggleProps {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function HubToggle({ checked, onChange, disabled, label }: HubToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || !onChange}
      onClick={() => onChange?.(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? 'bg-brand-600' : 'bg-slate-700'
      } ${disabled || !onChange ? 'cursor-default opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
