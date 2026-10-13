import React from "react";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import type { SocialKind } from "../lib/profile";

/** Simple line glyphs for each social link, drawn in the app's ink. */
export function SocialIcon({ kind, color, size = 20 }: { kind: SocialKind; color: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const };
  switch (kind) {
    case "instagram":
      return (
        <Svg {...common}>
          <Rect x={3.5} y={3.5} width={17} height={17} rx={5} stroke={color} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
          <Circle cx={17.2} cy={6.8} r={1.1} fill={color} />
        </Svg>
      );
    case "tiktok":
      return (
        <Svg {...common}>
          <Path
            d="M14 3.5v11.2a3.8 3.8 0 11-3.8-3.8M14 3.5c.4 2.6 2.3 4.4 5 4.6"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "twitter":
      return (
        <Svg {...common}>
          <Path d="M4.5 4.5l15 15M19.5 4.5l-15 15" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
        </Svg>
      );
    case "goodreads":
      return (
        <Svg {...common}>
          <SvgText x={12} y={17} fontSize={17} fontWeight="700" fill={color} textAnchor="middle">
            g
          </SvgText>
        </Svg>
      );
  }
}
