import type { TechType } from '../lib/techParser';
import { TECH_ICON_SVG } from '../lib/techIcons';

interface Props {
  type: TechType;
  className?: string;
}

/** Ikona typu elementu technicznego (nypel, trójnik, dysza…). */
export function TechTypeIcon({ type, className = 'h-5 w-5' }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: TECH_ICON_SVG[type] }}
    />
  );
}
