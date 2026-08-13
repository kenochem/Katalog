import { useEffect, useState } from 'react';
import { avatarInitials } from '../lib/userAvatar';

interface UserAvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

const SIZE: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
};

export function UserAvatar({
  name,
  src,
  size = 'md',
  onClick,
  className = '',
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const trimmed = src?.trim() ?? '';
  const showImg = Boolean(trimmed) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [trimmed]);

  const dim = SIZE[size];
  const inner = showImg ? (
    <img
      src={trimmed}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  ) : (
    <span>{avatarInitials(name)}</span>
  );
  const base = `${dim} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-600/80 to-brand-800/90 font-semibold text-white shadow-inner ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ring-2 ring-transparent transition hover:ring-brand-400/50`}
      >
        {inner}
      </button>
    );
  }
  return <span className={base}>{inner}</span>;
}
