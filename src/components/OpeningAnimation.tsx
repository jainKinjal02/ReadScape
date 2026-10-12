import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, Mask, Path, Rect } from "react-native-svg";
import { fonts } from "../design/tokens";
import {
  BOOK_PATH,
  INK,
  IVORY,
  MARK_BOX,
  PAGES_PATH,
  SUN,
  SUN_YELLOW,
} from "./brandMark";

// The closed book: a cover the open book's height, centred on its spine.
const CLOSED = { x: 627 - 120, y: 600, w: 240, h: 280 };

const VIEWBOX = `${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.width} ${MARK_BOX.height}`;

// Where each layer pivots, as a share of the mark's box: the book opens from
// its spine, the pages rise from where they leave the book, the sun from its
// own centre.
const pct = (v: number, start: number, size: number) => `${(((v - start) / size) * 100).toFixed(1)}%`;
const SPINE = `50% ${pct(860, MARK_BOX.y, MARK_BOX.height)}`;
const PAGE_ROOT = `50% ${pct(816, MARK_BOX.y, MARK_BOX.height)}`;
const SUN_ORIGIN = `${pct(SUN.cx, MARK_BOX.x, MARK_BOX.width)} ${pct(SUN.cy, MARK_BOX.y, MARK_BOX.height)}`;

/**
 * The opening: a closed book opens, its pages curl up into the hills, the sun
 * rises behind them and the name settles underneath. About 1.5 s, eased like a
 * page being turned, built from the icon's own shapes so it reads as the same
 * mark coming to life. Calls onDone when finished.
 */
export function OpeningAnimation({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const markW = Math.min(width * 0.68, 300);
  const markH = (markW * MARK_BOX.height) / MARK_BOX.width;

  const book = useRef(new Animated.Value(0)).current;
  const pages = useRef(new Animated.Value(0)).current;
  const sun = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const soft = Easing.bezier(0.33, 0, 0.2, 1); // a page settling, not a snap

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          // No motion: the finished mark, faded in.
          book.setValue(1);
          pages.setValue(1);
          sun.setValue(1);
          Animated.timing(word, { toValue: 1, duration: 350, useNativeDriver: true }).start(() =>
            setTimeout(onDone, 500)
          );
          return;
        }

        Animated.sequence([
          Animated.delay(150),
          Animated.parallel([
            Animated.timing(book, { toValue: 1, duration: 450, easing: soft, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(200),
              Animated.timing(pages, { toValue: 1, duration: 450, easing: soft, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.delay(560),
              Animated.timing(sun, {
                toValue: 1,
                duration: 320,
                easing: Easing.out(Easing.back(1.4)),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.delay(760),
              Animated.timing(word, { toValue: 1, duration: 300, easing: soft, useNativeDriver: true }),
            ]),
          ]),
          Animated.delay(200),
        ]).start(({ finished }) => finished && onDone());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const layer = { width: markW, height: markH };

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={layer}>
        {/* The sun sits behind the hills, with a sliver of paper between them. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: sun,
              transformOrigin: SUN_ORIGIN,
              transform: [
                { translateY: sun.interpolate({ inputRange: [0, 1], outputRange: [markH * 0.12, 0] }) },
                { scale: sun.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            },
          ]}
        >
          <Svg width={markW} height={markH} viewBox={VIEWBOX}>
            <Defs>
              <Mask id="behindHills" maskUnits="userSpaceOnUse" x={MARK_BOX.x} y={MARK_BOX.y} width={MARK_BOX.width} height={MARK_BOX.height}>
                <Rect x={MARK_BOX.x} y={MARK_BOX.y} width={MARK_BOX.width} height={MARK_BOX.height} fill="white" />
                <Path d={PAGES_PATH} fill="black" stroke="black" strokeWidth={26} strokeLinejoin="round" />
              </Mask>
            </Defs>
            <Circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill={SUN_YELLOW} mask="url(#behindHills)" />
          </Svg>
        </Animated.View>

        {/* The pages curl up out of the book into the landscape. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: pages.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
              transformOrigin: PAGE_ROOT,
              transform: [
                { scaleY: pages.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) },
                { scaleX: pages.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              ],
            },
          ]}
        >
          <Svg width={markW} height={markH} viewBox={VIEWBOX}>
            <Path d={PAGES_PATH} fill={INK} />
          </Svg>
        </Animated.View>

        {/* The open book, swinging out from the spine as the cover lifts. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: book.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              transformOrigin: SPINE,
              transform: [{ scaleX: book.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            },
          ]}
        >
          <Svg width={markW} height={markH} viewBox={VIEWBOX}>
            <Path d={BOOK_PATH} fill={INK} />
          </Svg>
        </Animated.View>

        {/* The closed book it starts as: a cover, with its page edges showing,
            that narrows away as it opens. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: book.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: "clamp" }),
              transformOrigin: SPINE,
              transform: [{ scaleX: book.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0.55], extrapolate: "clamp" }) }],
            },
          ]}
        >
          <Svg width={markW} height={markH} viewBox={VIEWBOX}>
            <Rect x={CLOSED.x} y={CLOSED.y} width={CLOSED.w} height={CLOSED.h} rx={22} fill={INK} />
            <Rect x={CLOSED.x + CLOSED.w - 46} y={CLOSED.y + 22} width={14} height={CLOSED.h - 44} rx={7} fill={IVORY} />
          </Svg>
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          styles.word,
          {
            opacity: word,
            transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
        Readscape
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IVORY,
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    marginTop: 18,
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 0.2,
    color: INK,
  },
});
