export default function Logo({ id = 'lg' }) {
  return (
    <svg className="logo-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.6 1 4 13.4h6.1L9.2 23 20 10.2h-6.6L13.6 1z" fill={`url(#${id})`} />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5c1a" />
          <stop offset=".6" stopColor="#ff2e8b" />
          <stop offset="1" stopColor="#6e56ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
