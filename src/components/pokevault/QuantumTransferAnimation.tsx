import React, { useEffect, useState } from "react";

// 1. Quantum Laser Scanner Overlay
export function QuantumLaserScanner({
  isScanning,
  side = "front",
}: {
  isScanning: boolean;
  side?: "front" | "back";
}) {
  if (!isScanning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-20">
      {/* Quantum Scanning Grid */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "16px 16px",
        }}
      />

      {/* Sweeping Laser Line */}
      <div
        className="absolute left-0 right-0 h-1.5 shadow-[0_0_20px_#38bdf8,0_0_40px_#818cf8] animate-laser-sweep"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #38bdf8 20%, #c084fc 50%, #38bdf8 80%, transparent 100%)",
        }}
      />

      {/* Dynamic Sub-Pixel Diagnostics HUD */}
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/80 backdrop-blur border border-cyan-500/40 text-[9px] font-mono text-cyan-300 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        QUANTUM PIXEL PASS: {side.toUpperCase()} (400x RESOLUTION)
      </div>

      <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 backdrop-blur border border-purple-500/40 text-[9px] font-mono text-purple-300">
        AST DEFECT RADAR ACTIVE
      </div>
    </div>
  );
}

// 2. 3D Card Flip Wrapper
export function QuantumFlipCard({
  frontContent,
  backContent,
  isFlipped,
  onFlip,
  className = "",
}: {
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
  isFlipped: boolean;
  onFlip?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`relative select-none cursor-pointer [perspective:1200px] ${className}`}
      onClick={onFlip}
      title="Click to flip front / back"
    >
      <div
        className="w-full h-full relative transition-transform duration-700 [transform-style:preserve-3d]"
        style={{
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front Face */}
        <div className="w-full h-full [backface-visibility:hidden]">{frontContent}</div>

        {/* Back Face */}
        <div
          className="w-full h-full absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          {backContent}
        </div>
      </div>
    </div>
  );
}

// 3. P2P Quantum Beam Trade Transfer Animation
export function P2PTradeBeamTransfer({
  isActive,
  onComplete,
  senderCardName,
  receiverCardName,
}: {
  isActive: boolean;
  onComplete: () => void;
  senderCardName: string;
  receiverCardName: string;
}) {
  const [phase, setPhase] = useState<"charging" | "beaming" | "settling">("charging");

  useEffect(() => {
    if (!isActive) return;
    setPhase("charging");
    const t1 = setTimeout(() => setPhase("beaming"), 600);
    const t2 = setTimeout(() => setPhase("settling"), 2200);
    const t3 = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-fade-in">
      {/* Background Energy Vortex */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0%,transparent_70%)] animate-pulse" />

      <div className="relative max-w-lg w-full mx-4 p-8 rounded-2xl bg-neutral-900/90 border border-cyan-500/50 shadow-[0_0_60px_rgba(56,189,248,0.3)] text-center overflow-hidden">
        {/* Animated Laser Beams Crossing */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-ping" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-4">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          ATOMIC P2P QUANTUM TRANSFER
        </div>

        <h3 className="text-xl font-bold text-white mb-2">
          {phase === "charging" && "⚡ Establishing Quantum Entanglement..."}
          {phase === "beaming" && "🌀 Synchronizing Dual Node Trade Beam..."}
          {phase === "settling" && "✨ Trade Ledger Finalized & Verified!"}
        </h3>

        <div className="flex items-center justify-center gap-6 my-6">
          <div className="px-4 py-3 rounded-xl bg-neutral-800/80 border border-cyan-500/40 text-left">
            <div className="text-[10px] text-neutral-400 uppercase font-mono">Sent to Peer</div>
            <div className="font-semibold text-cyan-300 text-sm">{senderCardName}</div>
          </div>

          <div className="text-2xl text-cyan-400 animate-bounce">⇄</div>

          <div className="px-4 py-3 rounded-xl bg-neutral-800/80 border border-purple-500/40 text-left">
            <div className="text-[10px] text-neutral-400 uppercase font-mono">
              Received from Peer
            </div>
            <div className="font-semibold text-purple-300 text-sm">{receiverCardName}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden border border-neutral-700">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 transition-all duration-700"
            style={{
              width: phase === "charging" ? "30%" : phase === "beaming" ? "80%" : "100%",
            }}
          />
        </div>

        <div className="mt-4 text-xs text-neutral-400 font-mono">
          Consensus Quorum: 4/4 Verified · Zero Collision Lock Active
        </div>
      </div>
    </div>
  );
}
