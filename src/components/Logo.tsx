import { useId } from 'react';

interface HeeeyLogoProps {
  className?: string;
  size?: number | string;
}

/** App icon: a continuous-corner squircle with a soft top light, like a platform app icon */
export function HeeeyLogo({ className = 'w-8 h-8' }: HeeeyLogoProps) {
  // Unique per instance: a gradient defined inside a hidden svg would not paint the others
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      className={`flex-shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8f5cf7" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <path
        d="M50 0C88 0 100 12 100 50C100 88 88 100 50 100C12 100 0 88 0 50C0 12 12 0 50 0Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M50 0.75C87.5 0.75 99.25 12.5 99.25 50"
        stroke="white"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <path
        d="M30 65 L45 35 L55 55 L70 35"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Logo + wordmark, used in the sidebar and docs header */
export function HeeeyWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <HeeeyLogo className="w-7 h-7" />
      <span className="text-[0.9375rem] font-semibold tracking-[-0.015em] text-label">
        heeey<span className="text-label-2">.click</span>
      </span>
    </span>
  );
}

export default HeeeyLogo;
