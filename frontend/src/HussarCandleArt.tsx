import React from "react";

interface Candle {
  x: number;
  y: number;
  bodyHeight: number;
  isBullish: boolean;
  rotation?: number;
}

/**
 * HussarCandleArt - A Polish winged Hussar formed by trading candles
 * Creates an epic silhouette of a lancer with magnificent wings
 * Perfect for a trading app landing page with Polish heritage flair
 */
export default function HussarCandleArt({
  className = "",
  size = 400,
}: {
  className?: string;
  size?: number;
}) {
  // Each candle: x, y position, body height, bullish/bearish
  // Arranged to form a charging Hussar with swept-back wings
  const candles: Candle[] = [
    // === WING (left side, arching up and back) ===
    // Top of wing - tall candles
    { x: 10, y: 35, bodyHeight: 28, isBullish: true },
    { x: 18, y: 30, bodyHeight: 32, isBullish: false },
    { x: 26, y: 28, bodyHeight: 35, isBullish: true },
    { x: 34, y: 32, bodyHeight: 30, isBullish: false },

    // Mid wing - spreading out
    { x: 8, y: 50, bodyHeight: 25, isBullish: false },
    { x: 16, y: 55, bodyHeight: 22, isBullish: true },
    { x: 24, y: 58, bodyHeight: 20, isBullish: false },
    { x: 32, y: 60, bodyHeight: 24, isBullish: true },
    { x: 40, y: 55, bodyHeight: 26, isBullish: false },

    // Lower wing - cascading feathers
    { x: 5, y: 70, bodyHeight: 18, isBullish: true },
    { x: 13, y: 75, bodyHeight: 20, isBullish: false },
    { x: 21, y: 78, bodyHeight: 22, isBullish: true },
    { x: 29, y: 80, bodyHeight: 19, isBullish: false },
    { x: 37, y: 82, bodyHeight: 21, isBullish: true },
    { x: 45, y: 78, bodyHeight: 18, isBullish: false },

    // Wing tip detail
    { x: 2, y: 85, bodyHeight: 15, isBullish: false },
    { x: 10, y: 90, bodyHeight: 16, isBullish: true },
    { x: 18, y: 92, bodyHeight: 14, isBullish: false },

    // === HELMET ===
    // Helmet base
    { x: 55, y: 45, bodyHeight: 18, isBullish: false },
    { x: 65, y: 43, bodyHeight: 20, isBullish: true },
    { x: 75, y: 45, bodyHeight: 18, isBullish: false },

    // Helmet crest (sweeping back)
    { x: 78, y: 30, bodyHeight: 15, isBullish: true },
    { x: 85, y: 25, bodyHeight: 12, isBullish: false },
    { x: 92, y: 22, bodyHeight: 10, isBullish: true },
    { x: 98, y: 20, bodyHeight: 8, isBullish: false },

    // Plume/feathers on helmet
    { x: 72, y: 35, bodyHeight: 10, isBullish: true },
    { x: 80, y: 38, bodyHeight: 8, isBullish: false },
    { x: 88, y: 35, bodyHeight: 6, isBullish: true },

    // === UPPER BODY / ARMOR ===
    { x: 52, y: 65, bodyHeight: 25, isBullish: true },
    { x: 62, y: 68, bodyHeight: 28, isBullish: false },
    { x: 72, y: 68, bodyHeight: 26, isBullish: true },
    { x: 82, y: 65, bodyHeight: 24, isBullish: false },

    // === LANCE (diagonal, held forward) ===
    // Lance shaft
    { x: 95, y: 55, bodyHeight: 35, isBullish: true },
    { x: 100, y: 62, bodyHeight: 38, isBullish: false },
    { x: 105, y: 70, bodyHeight: 40, isBullish: true },
    { x: 110, y: 78, bodyHeight: 42, isBullish: false },
    { x: 115, y: 87, bodyHeight: 38, isBullish: true },

    // Lance point
    { x: 118, y: 95, bodyHeight: 15, isBullish: true },

    // === TORSO ===
    { x: 55, y: 95, bodyHeight: 35, isBullish: false },
    { x: 65, y: 98, bodyHeight: 40, isBullish: true },
    { x: 75, y: 98, bodyHeight: 38, isBullish: false },
    { x: 85, y: 95, bodyHeight: 32, isBullish: true },

    // === ARM holding lance ===
    { x: 88, y: 82, bodyHeight: 22, isBullish: false },
    { x: 95, y: 85, bodyHeight: 20, isBullish: true },

    // === LEGS / SADDLE ===
    { x: 50, y: 130, bodyHeight: 30, isBullish: true },
    { x: 60, y: 135, bodyHeight: 35, isBullish: false },
    { x: 70, y: 135, bodyHeight: 32, isBullish: true },
    { x: 80, y: 130, bodyHeight: 28, isBullish: false },
    { x: 90, y: 125, bodyHeight: 25, isBullish: true },

    // Boots/feet
    { x: 55, y: 165, bodyHeight: 12, isBullish: false },
    { x: 75, y: 165, bodyHeight: 12, isBullish: true },

    // === HORSE HEAD (front) ===
    { x: 100, y: 115, bodyHeight: 20, isBullish: false },
    { x: 108, y: 110, bodyHeight: 25, isBullish: true },
    { x: 115, y: 105, bodyHeight: 28, isBullish: false },
    { x: 120, y: 100, bodyHeight: 22, isBullish: true },

    // Horse ear
    { x: 112, y: 95, bodyHeight: 10, isBullish: true },

    // === HORSE NECK/MANE ===
    { x: 85, y: 125, bodyHeight: 22, isBullish: true },
    { x: 92, y: 128, bodyHeight: 24, isBullish: false },
    { x: 98, y: 130, bodyHeight: 20, isBullish: true },

    // === HORSE BODY ===
    { x: 55, y: 155, bodyHeight: 25, isBullish: false },
    { x: 65, y: 158, bodyHeight: 28, isBullish: true },
    { x: 75, y: 158, bodyHeight: 26, isBullish: false },
    { x: 85, y: 155, bodyHeight: 24, isBullish: true },
    { x: 95, y: 150, bodyHeight: 22, isBullish: false },

    // Horse rear
    { x: 45, y: 160, bodyHeight: 20, isBullish: true },
    { x: 52, y: 165, bodyHeight: 18, isBullish: false },

    // === HORSE LEGS ===
    // Front legs
    { x: 95, y: 145, bodyHeight: 30, isBullish: true },
    { x: 102, y: 148, bodyHeight: 32, isBullish: false },
    { x: 100, y: 180, bodyHeight: 15, isBullish: true },

    // Back legs
    { x: 50, y: 175, bodyHeight: 28, isBullish: false },
    { x: 58, y: 178, bodyHeight: 30, isBullish: true },
    { x: 55, y: 208, bodyHeight: 12, isBullish: false },

    // Tail
    { x: 40, y: 155, bodyHeight: 35, isBullish: true, rotation: -15 },
  ];

  const scale = size / 140; // Base width is ~125
  const candleWidth = 5 * scale;
  const wickWidth = 1.2 * scale;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 220"
      className={`${className} drop-shadow-lg`}
      style={{ filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))" }}
    >
      {/* Background subtle glow */}
      <defs>
        <filter id="candleGlow">
          <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradient for depth */}
        <linearGradient id="bullishGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#10b981", stopOpacity: 0.9 }} />
          <stop offset="100%" style={{ stopColor: "#059669", stopOpacity: 0.7 }} />
        </linearGradient>

        <linearGradient id="bearishGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#ef4444", stopOpacity: 0.9 }} />
          <stop offset="100%" style={{ stopColor: "#dc2626", stopOpacity: 0.7 }} />
        </linearGradient>
      </defs>

      {/* Render each candle */}
      {candles.map((candle, idx) => {
        const wickColor = candle.isBullish ? "#10b981" : "#ef4444";
        const bodyColor = candle.isBullish ? "url(#bullishGrad)" : "url(#bearishGrad)";

        // Wick (thin vertical line)
        const wickX = candle.x + candleWidth / 2;
        const highY = candle.y - candle.bodyHeight * 0.5;
        const lowY = candle.y + candle.bodyHeight * 0.5;

        // Body (rectangle)
        const bodyY = candle.isBullish ? candle.y : candle.y - candle.bodyHeight;

        return (
          <g key={idx} filter="url(#candleGlow)">
            {/* Wick */}
            <line
              x1={wickX}
              y1={highY}
              x2={wickX}
              y2={lowY}
              stroke={wickColor}
              strokeWidth={wickWidth}
              opacity="0.8"
            />

            {/* Candle Body */}
            <rect
              x={candle.x}
              y={bodyY}
              width={candleWidth}
              height={candle.bodyHeight}
              fill={bodyColor}
              rx={candleWidth * 0.15}
              opacity="0.95"
            />

            {/* Edge highlight (subtle 3D effect) */}
            <line
              x1={candle.x}
              y1={bodyY}
              x2={candle.x}
              y2={bodyY + candle.bodyHeight}
              stroke="white"
              strokeWidth={wickWidth}
              opacity="0.15"
            />
          </g>
        );
      })}

      {/* Polish heraldry accent: small decorative banner below */}
      <text
        x="70"
        y="215"
        textAnchor="middle"
        fontSize="8"
        fill="#DC143C"
        fontWeight="bold"
        opacity="0.6"
      >
        ⚔ Hussar ⚔
      </text>
    </svg>
  );
}
