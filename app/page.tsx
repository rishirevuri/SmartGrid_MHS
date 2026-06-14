import Link from "next/link";
import { Sora, Inter } from "next/font/google";
import { ArrowRight, RadioTower } from "lucide-react";

// Refined modern display face for the hook; Inter for clean body copy (matches the sim UI).
const display = Sora({ subsets: ["latin"], weight: ["600", "700"] });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

// Orthogonal feeder traces that run, turn, and branch — like real grid / circuit routing.
const TRACES = [
  "M0 120 H180 V64 H400 V150 H520",
  "M110 0 V160 H300 V300 H450 V250",
  "M0 280 H120 V400 H250 V470 H360",
  "M0 520 H90 V610 H240 V700 H360",
  "M150 900 V740 H320 V620 H470 V690",
  "M0 800 H200 V860 H380",
  "M300 300 L360 360 H480 V300",
  "M1440 150 H1240 V80 H1030 V170 H880",
  "M1330 0 V180 H1150 V320 H1000 V270",
  "M1440 300 H1300 V410 H1170 V480 H1060",
  "M1440 560 H1340 V650 H1190 V730 H1060",
  "M1290 900 V720 H1110 V600 H960 V680",
  "M1440 790 H1230 V850 H1050",
  "M1150 320 L1090 380 H980 V320",
  "M0 440 H230 V510 H330",
  "M1440 470 H1210 V390 H1110"
];

// A brighter amber subset for accent + glow.
const ACCENT = [
  "M110 0 V160 H300 V300",
  "M1330 0 V180 H1150",
  "M150 900 V740 H320",
  "M1290 900 V720 H1110",
  "M0 280 H120 V400 H250"
];

// Traces that carry a travelling "energy" pulse.
const FLOW = [
  { d: "M0 280 H120 V400 H250 V470 H360", dur: "5.5s", delay: "0s" },
  { d: "M1330 0 V180 H1150 V320 H1000 V270", dur: "6.5s", delay: "1.2s" },
  { d: "M150 900 V740 H320 V620 H470 V690", dur: "7s", delay: "2.4s" }
];

const NODES: Array<[number, number]> = [
  [180, 120], [400, 64], [520, 150], [300, 160], [450, 300], [120, 280],
  [250, 400], [240, 610], [360, 700], [320, 740], [470, 620], [200, 800],
  [1240, 150], [1030, 80], [880, 170], [1150, 180], [1000, 320], [1300, 300],
  [1170, 410], [1190, 650], [1110, 720], [960, 600], [1230, 790]
];

const ACCENT_NODES: Array<[number, number]> = [
  [300, 300], [1150, 320], [120, 400], [1110, 390], [330, 510], [1060, 480]
];

// ── City skyline silhouette (drawn on a 1440×400 baseline, ground at y=400) ──
type NearBuilding = { x: number; w: number; h: number; roof: "flat" | "antenna" | "step" | "tower" };
type FarBuilding = { x: number; w: number; h: number };

const NEAR_BUILDINGS: NearBuilding[] = [
  { x: -10, w: 95, h: 210, roof: "step" },
  { x: 80, w: 70, h: 150, roof: "flat" },
  { x: 150, w: 64, h: 255, roof: "antenna" },
  { x: 214, w: 110, h: 185, roof: "flat" },
  { x: 322, w: 92, h: 300, roof: "tower" },
  { x: 412, w: 58, h: 150, roof: "flat" },
  { x: 470, w: 120, h: 235, roof: "step" },
  { x: 588, w: 78, h: 330, roof: "antenna" },
  { x: 664, w: 104, h: 195, roof: "flat" },
  { x: 766, w: 70, h: 268, roof: "flat" },
  { x: 834, w: 116, h: 165, roof: "step" },
  { x: 948, w: 88, h: 292, roof: "antenna" },
  { x: 1034, w: 108, h: 205, roof: "flat" },
  { x: 1140, w: 78, h: 250, roof: "tower" },
  { x: 1216, w: 120, h: 175, roof: "step" },
  { x: 1334, w: 96, h: 226, roof: "antenna" },
  { x: 1428, w: 60, h: 160, roof: "flat" }
];

const FAR_BUILDINGS: FarBuilding[] = [
  { x: -20, w: 80, h: 120 }, { x: 60, w: 90, h: 95 }, { x: 150, w: 70, h: 150 },
  { x: 230, w: 110, h: 110 }, { x: 340, w: 80, h: 165 }, { x: 430, w: 100, h: 100 },
  { x: 540, w: 80, h: 160 }, { x: 630, w: 120, h: 120 }, { x: 760, w: 90, h: 150 },
  { x: 860, w: 100, h: 105 }, { x: 970, w: 90, h: 170 }, { x: 1070, w: 110, h: 115 },
  { x: 1190, w: 90, h: 155 }, { x: 1290, w: 100, h: 120 }, { x: 1390, w: 90, h: 145 }
];

// Deterministic lit-window scatter (no Math.random → no hydration drift).
function buildingWindows(b: NearBuilding, seed: number) {
  const top = 400 - b.h;
  const wins = [];
  for (let cx = Math.round(b.x) + 11; cx <= b.x + b.w - 16; cx += 18) {
    for (let cy = top + 16; cy <= 400 - 18; cy += 22) {
      if (((cx * 13 + cy * 7 + seed * 29) % 6) === 0) {
        wins.push(<rect key={`w-${seed}-${cx}-${cy}`} x={cx} y={cy} width={5} height={9} fill="#fcd34d" fillOpacity={0.5} />);
      }
    }
  }
  return wins;
}

function buildingRoof(b: NearBuilding, seed: number) {
  const top = 400 - b.h;
  const cx = b.x + b.w / 2;
  if (b.roof === "antenna") {
    return (
      <g key={`r-${seed}`}>
        <line x1={cx} y1={top} x2={cx} y2={top - 44} stroke="#0a0c10" strokeWidth={2.5} />
        <circle cx={cx} cy={top - 44} r={2.8} fill="#f87171" className="sg-beacon" style={{ animationDelay: `${(seed % 4) * 0.6}s` }} />
      </g>
    );
  }
  if (b.roof === "step") {
    return <rect key={`r-${seed}`} x={b.x + b.w * 0.28} y={top - 22} width={b.w * 0.44} height={22} fill="url(#nearFill)" stroke="#fde68a" strokeOpacity={0.22} strokeWidth={1.4} />;
  }
  if (b.roof === "tower") {
    return <rect key={`r-${seed}`} x={cx - 13} y={top - 28} width={26} height={28} rx={2} fill="url(#nearFill)" stroke="#fde68a" strokeOpacity={0.22} strokeWidth={1.4} />;
  }
  return null;
}

export default function LandingPage() {
  return (
    <main
      className={`relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 py-20 text-center ${body.className}`}
      style={{ backgroundColor: "#000000" }}
    >
      {/* Sporadic grid / feeder-trace network */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="warmGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base traces */}
        <g fill="none" stroke="#f59e0b" strokeOpacity="0.2" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
          {TRACES.map((d, i) => (
            <path key={`t-${i}`} d={d} />
          ))}
        </g>

        {/* Amber accent traces with glow */}
        <g fill="none" stroke="#fbbf24" strokeOpacity="0.55" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" filter="url(#warmGlow)">
          {ACCENT.map((d, i) => (
            <path key={`a-${i}`} d={d} />
          ))}
        </g>

        {/* Travelling energy pulses */}
        <g fill="none" stroke="#fde68a" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" filter="url(#warmGlow)">
          {FLOW.map(({ d, dur, delay }, i) => (
            <path
              key={`f-${i}`}
              d={d}
              className="sg-flow"
              style={{ animationDuration: dur, animationDelay: delay }}
            />
          ))}
        </g>

        {/* Junction nodes */}
        <g fill="#fbbf24" fillOpacity="0.3">
          {NODES.map(([x, y], i) => (
            <circle key={`n-${i}`} cx={x} cy={y} r="2.4" />
          ))}
        </g>
        <g fill="#fcd34d" filter="url(#warmGlow)">
          {ACCENT_NODES.map(([x, y], i) => (
            <circle
              key={`an-${i}`}
              cx={x}
              cy={y}
              r="3"
              className="sg-node"
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          ))}
        </g>
      </svg>

      {/* Warm city-glow haze rising from the skyline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0"
        style={{
          height: "46vh",
          background:
            "linear-gradient(to top, rgba(255,140,40,0.13) 0%, rgba(255,120,30,0.05) 36%, transparent 76%)"
        }}
      />

      {/* Realistic city skyline silhouette */}
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-0 w-full"
        style={{ height: "auto" }}
        viewBox="0 0 1440 400"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <linearGradient id="nearFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c0f15" />
            <stop offset="100%" stopColor="#050608" />
          </linearGradient>
        </defs>

        {/* Far layer — lighter + shorter to recede, faint edge outline */}
        <g fill="#11151d" fillOpacity="0.6" stroke="#fde68a" strokeOpacity="0.12" strokeWidth="1.1">
          {FAR_BUILDINGS.map((b, i) => (
            <rect key={`fb-${i}`} x={b.x} y={400 - b.h} width={b.w} height={b.h} />
          ))}
        </g>

        {/* Near layer — dark silhouettes with lit windows + rooftops */}
        <g>
          {NEAR_BUILDINGS.map((b, i) => (
            <g key={`nb-${i}`}>
              <rect x={b.x} y={400 - b.h} width={b.w} height={b.h} fill="url(#nearFill)" stroke="#fde68a" strokeOpacity={0.22} strokeWidth={1.4} />
              {buildingWindows(b, i)}
              {buildingRoof(b, i)}
            </g>
          ))}
        </g>
      </svg>

      {/* Warm hue washed over the outer edges + corners for color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 85% at 50% 50%, transparent 50%, rgba(255,150,30,0.12) 100%), radial-gradient(circle at 0% 0%, rgba(255,170,40,0.16), transparent 38%), radial-gradient(circle at 100% 100%, rgba(255,140,30,0.14), transparent 40%)"
        }}
      />

      {/* Soft warm glow behind the headline for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 56% 46% at 50% 42%, rgba(255,180,60,0.09) 0%, transparent 70%)"
        }}
      />

      {/* Dark scrim behind the copy so the brighter grid stays legible */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 52% 50% at 50% 46%, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 56%, transparent 80%)"
        }}
      />

      {/* Animations */}
      <style>{`
        @keyframes sg-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sg-anim { opacity: 0; animation: sg-fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes sg-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .sg-node { animation: sg-pulse 3.2s ease-in-out infinite; }
        @keyframes sg-flow-dash { to { stroke-dashoffset: -600; } }
        .sg-flow { stroke-dasharray: 7 230; stroke-dashoffset: 0; animation-name: sg-flow-dash; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes sg-beacon { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0.12; } }
        .sg-beacon { animation: sg-beacon 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sg-anim { animation: none; opacity: 1; }
          .sg-node, .sg-flow, .sg-beacon { animation: none; }
        }
      `}</style>

      {/* Top-left brand badge */}
      <div className="dark-chip sg-anim absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full px-3.5 py-2">
        <RadioTower className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-xs font-medium text-zinc-200">SmartGrid Digital Twin</span>
      </div>

      {/* Top-right status badge */}
      <div className="dark-chip sg-anim absolute right-6 top-6 z-20 flex items-center gap-2 rounded-full px-3.5 py-2" style={{ animationDelay: "120ms" }}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-teal-300" />
        <span className="text-xs font-medium text-zinc-200">Sustainability Track · Live Simulation Ready</span>
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex w-full max-w-[900px] flex-col items-center">
        {/* Eyebrow */}
        <p
          className="sg-anim"
          style={{
            fontSize: "11px",
            letterSpacing: "0.32em",
            color: "rgba(252,211,77,0.85)",
            fontWeight: 600,
            textTransform: "uppercase"
          }}
        >
          AI-Powered Grid Intelligence
        </p>

        {/* Headline */}
        <h1
          className={`sg-anim mt-6 text-[40px] leading-[1.0] md:text-[64px] ${display.className}`}
          style={{ fontWeight: 800, letterSpacing: "-0.03em", color: "#ffffff", maxWidth: "700px", animationDelay: "60ms" }}
        >
          Manual Grid Operations Turned into{" "}
          <span
            style={{
              background: "linear-gradient(110deg, #fde68a 0%, #fbbf24 48%, #f97316 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent"
            }}
          >
            Sustainable Proactive Decisions
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className="sg-anim mt-7"
          style={{
            fontSize: "18px",
            color: "rgba(255,255,255,0.58)",
            maxWidth: "620px",
            lineHeight: 1.65,
            fontWeight: 400,
            animationDelay: "150ms"
          }}
        >
          SmartGrid uses AI to forecast grid stress, simulate cascading failures, and
          reroute power toward critical infrastructure before outages spread.
        </p>

        {/* CTA */}
        <Link
          href="/simulation"
          className="sg-anim group mt-10 inline-block"
          style={{ animationDelay: "280ms" }}
        >
          <span
            className="inline-flex items-center gap-2 transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:bg-white group-hover:shadow-[0_0_0_1px_rgba(251,191,36,0.45),0_22px_60px_-12px_rgba(245,158,11,0.65)]"
            style={{
              background: "#ffffff",
              color: "#000000",
              fontWeight: 800,
              fontSize: "18px",
              padding: "18px 36px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 18px 50px -12px rgba(245,158,11,0.45)"
            }}
          >
            Run Simulation
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>

        {/* Supporting text */}
        <p
          className="sg-anim"
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.05em",
            marginTop: "18px",
            fontWeight: 500,
            animationDelay: "280ms"
          }}
        >
          Built on San Francisco grid topology · 29 substations · 259 feeder lines
        </p>
      </div>

      {/* Footer mark */}
      <p
        className="absolute"
        style={{
          bottom: "20px",
          fontSize: "10px",
          letterSpacing: "0.04em",
          color: "rgba(255,255,255,0.16)"
        }}
      >
        SmartGrid · Sustainable City Grid Intelligence
      </p>
    </main>
  );
}
