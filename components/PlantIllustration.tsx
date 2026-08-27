export function PlantIllustration() {
  return (
    <svg className="plant" viewBox="0 0 210 220" role="img" aria-label="Pianta illustrata da ufficio">
      <defs>
        <linearGradient id="pot" x1="0" x2="1">
          <stop offset="0" stopColor="#d9b0ff" />
          <stop offset="1" stopColor="#ffb7cf" />
        </linearGradient>
        <linearGradient id="leaf" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#5cc8a1" />
          <stop offset="1" stopColor="#b8e986" />
        </linearGradient>
      </defs>
      <ellipse cx="106" cy="205" rx="62" ry="9" fill="#382e88" opacity=".25" />
      <path d="M70 150h73l-9 55H79z" fill="url(#pot)" />
      <path d="M65 145c0-8 6-13 13-13h58c8 0 14 5 14 13v8H65z" fill="#f4d6ff" />
      <path d="M108 135C89 93 85 52 92 18" fill="none" stroke="#77c99d" strokeWidth="5" strokeLinecap="round" />
      <path d="M108 136c15-36 35-66 57-87M105 133C83 104 60 85 33 72M105 135c0-33 8-61 25-85" fill="none" stroke="#77c99d" strokeWidth="4" strokeLinecap="round" />
      <path d="M91 56C58 54 44 35 48 17c29 1 45 15 43 39Z" fill="url(#leaf)" />
      <path d="M123 78c-5-27 8-48 31-55 8 26-3 47-31 55Z" fill="#79d7be" />
      <path d="M142 82c5-28 24-43 48-40-2 27-18 43-48 40Z" fill="url(#leaf)" />
      <path d="M76 102C48 107 27 96 20 73c28-7 49 3 56 29Z" fill="#9ee3b0" />
      <path d="M111 111c-11-29-4-53 17-67 15 25 9 48-17 67Z" fill="#4abf9d" />
      <path d="M116 128c18-24 40-33 64-24-13 27-36 35-64 24Z" fill="#a9df80" />
      <circle cx="178" cy="102" r="5" fill="#ffb7cf" />
      <circle cx="31" cy="68" r="4" fill="#d9b0ff" />
    </svg>
  );
}
