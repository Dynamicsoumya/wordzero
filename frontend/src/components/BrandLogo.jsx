export default function BrandLogo({ size = 44 }) {
  const icon = Math.round(size * 0.58);
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={icon} height={icon} viewBox="0 0 32 32" fill="none">
        <path d="M2 17h7.2l2.3-7 4.2 14 2.6-7H30" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
