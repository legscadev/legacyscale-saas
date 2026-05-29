export function AuroraBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <style>{`
        @keyframes ls-drift-a {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(50px, 40px, 0) scale(1.08); }
        }
        @keyframes ls-drift-b {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(-40px, -30px, 0) scale(1.06); }
        }
        @keyframes ls-pulse {
          0%, 100% { transform: translate3d(-50%, -50%, 0) scale(1);    opacity: 0.6; }
          50%      { transform: translate3d(-50%, -50%, 0) scale(1.12); opacity: 1;   }
        }
        .ls-aurora-a { animation: ls-drift-a 24s ease-in-out infinite; will-change: transform; }
        .ls-aurora-b { animation: ls-drift-b 32s ease-in-out infinite; will-change: transform; }
        .ls-aurora-c { animation: ls-pulse   9s ease-in-out infinite; will-change: transform, opacity; }
        @media (prefers-reduced-motion: reduce) {
          .ls-aurora-a, .ls-aurora-b, .ls-aurora-c { animation: none !important; }
        }
      `}</style>

      {/* Base — static gradient with horizon warmth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 100%,#1a0712 0%,#0a050c 50%,#050308 100%)',
        }}
      />

      {/* Drifting red bloom — top left */}
      <div
        className="ls-aurora-a absolute"
        style={{
          left: '-10%',
          top: '-12%',
          width: '50vw',
          height: '50vw',
          borderRadius: '50%',
          background:
            'radial-gradient(circle,rgba(255,90,90,0.55) 0%,rgba(209,26,26,0.18) 40%,transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Drifting violet bloom — bottom right */}
      <div
        className="ls-aurora-b absolute"
        style={{
          right: '-8%',
          bottom: '-5%',
          width: '45vw',
          height: '45vw',
          borderRadius: '50%',
          background:
            'radial-gradient(circle,rgba(140,80,255,0.32) 0%,rgba(90,40,200,0.12) 40%,transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Central pulse — focal anchor behind the type */}
      <div
        className="ls-aurora-c absolute left-1/2 top-[55%]"
        style={{
          width: '35vw',
          height: '35vw',
          borderRadius: '50%',
          background:
            'radial-gradient(circle,rgba(255,120,120,0.35) 0%,rgba(255,80,80,0.1) 35%,transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Static horizon warmth — no animation */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 100%,rgba(255,90,90,0.25) 0%,rgba(209,26,26,0.08) 40%,transparent 75%)',
        }}
      />

      {/* Top fade — for nav blend */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#08070a] to-transparent" />
    </div>
  )
}
