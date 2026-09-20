import './SplashScreen.css';

export default function SplashScreen() {
  return <div className="splash-screen" role="status" aria-label="Preparing your workspace">
    <svg className="splash-backdrop" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="splash-grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#6aabff" strokeWidth=".6" /></pattern>
        <linearGradient id="splash-orbit" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#38baff" /><stop offset="1" stopColor="#8b65ea" /></linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#splash-grid)" opacity=".07" />
      <g className="splash-orbits" fill="none" stroke="url(#splash-orbit)" strokeWidth="1.2">
        <ellipse cx="720" cy="280" rx="910" ry="410" transform="rotate(-24 720 280)" />
        <ellipse cx="1370" cy="900" rx="950" ry="400" transform="rotate(-24 1370 900)" />
        <circle cx="1810" cy="50" r="380" />
      </g>
      <g className="splash-background-formulas" fill="#83baff">
        <text x="150" y="190" fontSize="48">¬P → Q</text><text x="215" y="325" fontSize="38">P ∨ Q</text>
        <text x="110" y="455" fontSize="34">(P ∧ R) → S</text><text x="1650" y="170" fontSize="38">P ∨ ¬P</text>
        <text x="1480" y="950" fontSize="32">(A ∧ B) → C</text>
      </g>
      <g className="splash-background-proof" fill="none" stroke="#6da9ef" strokeWidth="1.5">
        <rect x="1430" y="320" width="195" height="60" rx="11" /><rect x="1670" y="320" width="195" height="60" rx="11" />
        <path d="M1528 380C1528 435 1638 410 1638 475M1768 380C1768 435 1638 410 1638 475" />
        <rect x="1540" y="475" width="195" height="60" rx="11" /><rect x="1430" y="560" width="195" height="60" rx="11" />
        <path d="M1638 535V650M1528 620C1528 650 1638 625 1638 650M1638 650V670" />
        <rect x="1608" y="670" width="60" height="60" rx="10" />
        <g fill="#8abcff" stroke="none" textAnchor="middle" fontSize="23"><text x="1528" y="358">¬P ∨ Q</text><text x="1768" y="358">P</text><text x="1638" y="513">Q</text><text x="1528" y="598">¬Q</text><text x="1638" y="710">□</text></g>
      </g>
      <g className="splash-background-sets" fill="none" stroke="#6da9ef" strokeWidth="1.5">
        <circle cx="165" cy="780" r="90" /><circle cx="280" cy="780" r="90" /><circle cx="223" cy="880" r="90" />
        <g fill="#8abcff" stroke="none" fontSize="34" textAnchor="middle"><text x="140" y="787">P</text><text x="307" y="787">Q</text><text x="223" y="910">R</text></g>
      </g>
      <g fill="#43b5ff" opacity=".3"><circle cx="500" cy="235" r="4" /><circle cx="1240" cy="125" r="5" /><circle cx="125" cy="555" r="5" /><circle cx="1750" cy="820" r="4" /></g>
    </svg>
    <div className="splash-core">
      <svg className="splash-mark" viewBox="0 0 360 218" aria-hidden="true">
        <defs>
          <linearGradient id="splash-wire" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2baaff" /><stop offset="1" stopColor="#6fdcff" /></linearGradient>
          <radialGradient id="splash-node"><stop stopColor="#123966" /><stop offset="1" stopColor="#071d3b" /></radialGradient>
        </defs>
        <path className="splash-mark-wire" d="M99 73C127 95 179 94 180 141M261 73C233 95 181 94 180 141" fill="none" stroke="url(#splash-wire)" strokeWidth="2.7" />
        <g fill="url(#splash-node)" strokeWidth="2.7"><circle cx="70" cy="49" r="43" stroke="#2daaff" /><circle cx="290" cy="49" r="43" stroke="#a078ff" /><circle cx="180" cy="172" r="43" stroke="#46c5ff" /></g>
        <g fill="#eff7ff" textAnchor="middle" fontSize="46"><text x="70" y="63">∧</text><text x="290" y="63">∨</text><text x="180" y="187">⊥</text></g>
        <circle className="splash-mark-junction" cx="180" cy="137" r="3.5" fill="#76d9ff" />
      </svg>
      <h1 className="splash-wordmark">Res<span>Viz</span></h1>
      <p className="splash-tagline">Visualise logic. <span>Understand resolution.</span></p>
      <div className="splash-loading"><span className="splash-loading-dots" aria-hidden="true"><i /><i /><i /></span><span>Preparing your workspace</span></div>
    </div>
  </div>;
}
