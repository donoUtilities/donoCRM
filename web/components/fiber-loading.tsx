"use client";

/**
 * FiberLoadingAnimation — Fiber optic cable with lightning current
 * traveling from left to right in a continuous loop.
 */
export function FiberLoadingAnimation() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      {/* Fiber cable container */}
      <div className="fiber-cable-container">
        {/* Glow backdrop */}
        <div className="fiber-glow" />
        {/* The cable line */}
        <div className="fiber-cable">
          {/* Animated lightning pulse */}
          <div className="fiber-pulse" />
          <div className="fiber-pulse fiber-pulse-2" />
          <div className="fiber-pulse fiber-pulse-3" />
          {/* Static nodes on the cable */}
          <div className="fiber-node fiber-node-start" />
          <div className="fiber-node fiber-node-end" />
        </div>
        {/* Spark particles */}
        <div className="fiber-sparks">
          <div className="spark spark-1" />
          <div className="spark spark-2" />
          <div className="spark spark-3" />
          <div className="spark spark-4" />
          <div className="spark spark-5" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">Loading data…</p>

      <style jsx>{`
        .fiber-cable-container {
          position: relative;
          width: 280px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fiber-glow {
          position: absolute;
          inset: -8px;
          border-radius: 20px;
          background: radial-gradient(ellipse at center, rgba(56, 189, 248, 0.08) 0%, transparent 70%);
          animation: glowPulse 2s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .fiber-cable {
          position: relative;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg,
            rgba(100, 116, 139, 0.3) 0%,
            rgba(100, 116, 139, 0.5) 50%,
            rgba(100, 116, 139, 0.3) 100%
          );
          border-radius: 2px;
          overflow: visible;
        }

        /* Lightning pulse traveling left → right */
        .fiber-pulse {
          position: absolute;
          top: 50%;
          left: -20%;
          width: 30%;
          height: 3px;
          transform: translateY(-50%);
          border-radius: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(56, 189, 248, 0.4) 10%,
            rgba(56, 189, 248, 1) 40%,
            rgba(255, 255, 255, 1) 50%,
            rgba(56, 189, 248, 1) 60%,
            rgba(56, 189, 248, 0.4) 90%,
            transparent 100%
          );
          box-shadow:
            0 0 8px rgba(56, 189, 248, 0.8),
            0 0 20px rgba(56, 189, 248, 0.4),
            0 0 40px rgba(56, 189, 248, 0.2);
          animation: pulseFly 1.4s ease-in-out infinite;
        }

        .fiber-pulse-2 {
          width: 20%;
          animation: pulseFly 1.4s ease-in-out 0.5s infinite;
          opacity: 0.7;
        }

        .fiber-pulse-3 {
          width: 15%;
          animation: pulseFly 1.4s ease-in-out 0.9s infinite;
          opacity: 0.5;
        }

        @keyframes pulseFly {
          0% {
            left: -30%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            left: 120%;
            opacity: 0;
          }
        }

        /* Endpoint nodes */
        .fiber-node {
          position: absolute;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transform: translateY(-50%);
          background: rgba(100, 116, 139, 0.6);
          border: 2px solid rgba(100, 116, 139, 0.4);
          z-index: 2;
          animation: nodeGlow 1.4s ease-in-out infinite;
        }

        .fiber-node-start {
          left: -5px;
          animation-delay: 0s;
        }

        .fiber-node-end {
          right: -5px;
          animation-delay: 0.7s;
        }

        @keyframes nodeGlow {
          0%, 100% {
            background: rgba(100, 116, 139, 0.6);
            border-color: rgba(100, 116, 139, 0.4);
            box-shadow: none;
          }
          30%, 50% {
            background: rgba(56, 189, 248, 0.9);
            border-color: rgba(56, 189, 248, 0.6);
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.6), 0 0 20px rgba(56, 189, 248, 0.3);
          }
        }

        /* Floating spark particles */
        .fiber-sparks {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .spark {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.9);
          box-shadow: 0 0 4px rgba(56, 189, 248, 0.8);
          animation: sparkFloat 1.4s ease-out infinite;
          opacity: 0;
        }

        .spark-1 { left: 20%; animation-delay: 0.2s; }
        .spark-2 { left: 40%; animation-delay: 0.5s; }
        .spark-3 { left: 60%; animation-delay: 0.8s; }
        .spark-4 { left: 75%; animation-delay: 1.0s; }
        .spark-5 { left: 50%; animation-delay: 0.3s; }

        @keyframes sparkFloat {
          0% {
            top: 50%;
            opacity: 0;
            transform: translateY(0) scale(1);
          }
          20% {
            opacity: 1;
          }
          100% {
            top: 10%;
            opacity: 0;
            transform: translateY(-10px) scale(0);
          }
        }
      `}</style>
    </div>
  );
}
