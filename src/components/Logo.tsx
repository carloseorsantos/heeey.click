interface HeeeyLogoProps {
  className?: string;
  size?: number | string;
}

export function HeeeyLogo({ className = 'w-8 h-8' }: HeeeyLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`flex-shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="24" fill="#7c3aed" />
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

export default HeeeyLogo;
