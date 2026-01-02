import React from "react";

/**
 * HussarCandleArt - A Polish winged Hussar SVG illustration
 * Epic silhouette of a lancer with magnificent wings using SVG paths & fills
 * Perfect for a trading app landing page with Polish heritage flair
 */
export default function HussarCandleArt({
  className = "",
  size = 400,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 400"
      className={`${className}`}
      style={{ filter: "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="greenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="redGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.8" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* LEFT WING - Swept back dramatically */}
      <path
        d="M 80 80 Q 40 60 20 100 Q 10 130 30 160 Q 50 140 60 120 Z"
        fill="url(#greenGrad)"
        opacity="0.9"
        filter="url(#glow)"
      />
      <path
        d="M 20 100 Q 0 110 15 150 Q 40 130 50 110 Z"
        fill="url(#redGrad)"
        opacity="0.85"
        filter="url(#glow)"
      />

      {/* HELMET & HEAD */}
      <ellipse cx="150" cy="70" rx="25" ry="32" fill="url(#greenGrad)" opacity="0.95" filter="url(#glow)" />
      {/* Helmet crest sweeping back */}
      <path
        d="M 170 60 Q 200 40 220 35 Q 200 50 180 70"
        fill="url(#redGrad)"
        opacity="0.9"
        filter="url(#glow)"
      />
      {/* Plume on helmet */}
      <path d="M 175 50 Q 190 30 200 25" stroke="#10b981" strokeWidth="4" fill="none" opacity="0.85" />

      {/* NECK & SHOULDERS */}
      <path
        d="M 140 100 L 130 130 L 170 130 L 160 100 Z"
        fill="url(#greenGrad)"
        opacity="0.9"
        filter="url(#glow)"
      />

      {/* UPPER BODY / ARMOR */}
      <ellipse cx="150" cy="160" rx="45" ry="50" fill="url(#redGrad)" opacity="0.9" filter="url(#glow)" />
      {/* Armor detail */}
      <path
        d="M 110 150 L 105 190 L 195 190 L 190 150"
        fill="url(#greenGrad)"
        opacity="0.7"
        filter="url(#glow)"
      />

      {/* ARM HOLDING LANCE */}
      <path
        d="M 190 140 Q 220 130 240 120"
        stroke="url(#redGrad)"
        strokeWidth="12"
        fill="none"
        opacity="0.9"
        strokeLinecap="round"
        filter="url(#glow)"
      />

      {/* LANCE - diagonal, aggressive angle */}
      <path
        d="M 240 120 L 280 30"
        stroke="url(#greenGrad)"
        strokeWidth="6"
        opacity="0.95"
        filter="url(#glow)"
      />
      {/* Lance point (arrowhead) */}
      <path d="M 280 30 L 275 45 L 285 40 Z" fill="url(#redGrad)" opacity="1" filter="url(#glow)" />

      {/* LEGS / SADDLE */}
      <rect x="120" y="210" width="60" height="50" fill="url(#greenGrad)" opacity="0.9" rx="4" filter="url(#glow)" />

      {/* LEFT LEG */}
      <rect x="110" y="260" width="15" height="80" fill="url(#redGrad)" opacity="0.85" rx="3" filter="url(#glow)" />
      {/* LEFT BOOT */}
      <ellipse cx="117" cy="350" rx="10" ry="8" fill="url(#greenGrad)" opacity="0.9" filter="url(#glow)" />

      {/* RIGHT LEG */}
      <rect x="175" y="260" width="15" height="80" fill="url(#greenGrad)" opacity="0.85" rx="3" filter="url(#glow)" />
      {/* RIGHT BOOT */}
      <ellipse cx="182" cy="350" rx="10" ry="8" fill="url(#redGrad)" opacity="0.9" filter="url(#glow)" />

      {/* HORSE BODY */}
      <ellipse cx="150" cy="280" rx="70" ry="50" fill="url(#greenGrad)" opacity="0.95" filter="url(#glow)" />

      {/* HORSE NECK */}
      <path
        d="M 180 250 Q 210 230 230 220"
        stroke="url(#redGrad)"
        strokeWidth="28"
        fill="none"
        opacity="0.9"
        strokeLinecap="round"
        filter="url(#glow)"
      />

      {/* HORSE HEAD */}
      <ellipse cx="245" cy="205" rx="22" ry="26" fill="url(#greenGrad)" opacity="0.95" filter="url(#glow)" />
      {/* Horse ear */}
      <path d="M 250 185 L 260 165 L 255 190 Z" fill="url(#redGrad)" opacity="0.9" filter="url(#glow)" />
      {/* Horse eye (small accent) */}
      <circle cx="250" cy="200" r="3" fill="#DC143C" opacity="0.8" />

      {/* HORSE MANE (flowing) */}
      <path
        d="M 240 190 Q 250 170 260 180 Q 250 195 240 200"
        fill="url(#redGrad)"
        opacity="0.85"
        filter="url(#glow)"
      />

      {/* FRONT LEFT LEG */}
      <rect x="170" y="320" width="18" height="75" fill="url(#redGrad)" opacity="0.85" rx="4" filter="url(#glow)" />
      {/* Hoof */}
      <ellipse cx="179" cy="400" rx="12" ry="6" fill="url(#greenGrad)" opacity="0.9" filter="url(#glow)" />

      {/* FRONT RIGHT LEG */}
      <rect x="210" y="320" width="18" height="75" fill="url(#greenGrad)" opacity="0.85" rx="4" filter="url(#glow)" />
      {/* Hoof */}
      <ellipse cx="219" cy="400" rx="12" ry="6" fill="url(#redGrad)" opacity="0.9" filter="url(#glow)" />

      {/* BACK LEGS (partially hidden behind body) */}
      <rect x="90" y="320" width="16" height="70" fill="url(#greenGrad)" opacity="0.75" rx="3" filter="url(#glow)" />
      <ellipse cx="98" cy="395" rx="10" ry="5" fill="url(#redGrad)" opacity="0.8" filter="url(#glow)" />

      <rect x="130" y="325" width="16" height="65" fill="url(#redGrad)" opacity="0.75" rx="3" filter="url(#glow)" />
      <ellipse cx="138" cy="395" rx="10" ry="5" fill="url(#greenGrad)" opacity="0.8" filter="url(#glow)" />

      {/* TAIL (flowing dramatically) */}
      <path
        d="M 75 280 Q 30 300 40 340 Q 50 320 70 300"
        fill="url(#greenGrad)"
        opacity="0.9"
        filter="url(#glow)"
      />
      <path
        d="M 40 340 Q 20 360 35 380"
        stroke="url(#redGrad)"
        strokeWidth="8"
        fill="none"
        opacity="0.85"
        strokeLinecap="round"
        filter="url(#glow)"
      />

      {/* Polish banner text at bottom */}
      <text
        x="150"
        y="395"
        textAnchor="middle"
        fontSize="14"
        fontWeight="bold"
        fill="#DC143C"
        opacity="0.7"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        ⚔ Hussar ⚔
      </text>
    </svg>
  );
}
