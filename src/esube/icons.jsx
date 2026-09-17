// APK'daki UI/Glyph.cs ikonlarının birebir SVG karşılığı.
// Orijinal 24 birimlik ızgarada çizilir ve size/20 ile ölçeklenir; burada viewBox "2 2 20 20"
// ile aynı oran korunur (20 birim = size piksel), çizgi kalınlığı 1.65, uçlar yuvarlak.
import React from "react";

const P = ({ d }) => <path d={d} />;
const F = ({ d }) => <path d={d} fill="currentColor" stroke="none" />;
const C = (cx, cy, r, key) => <circle key={key} cx={cx} cy={cy} r={r} />;
const FC = (cx, cy, r, key) => <circle key={key} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
const R = (x, y, w, h, rx, key) => <rect key={key} x={x} y={y} width={w} height={h} rx={rx} />;
const FR = (x, y, w, h, rx, key) => <rect key={key} x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" stroke="none" />;
const L = (...xy) => {
  let d = `M${xy[0]} ${xy[1]}`;
  for (let i = 2; i < xy.length; i += 2) d += `L${xy[i]} ${xy[i + 1]}`;
  return d;
};

const gearTeeth = () => {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    parts.push(
      <path key={`t${i}`} d={L(12 + 6.3 * Math.cos(a), 12 + 6.3 * Math.sin(a), 12 + 9.6 * Math.cos(a), 12 + 9.6 * Math.sin(a))} />
    );
  }
  return parts;
};

const fingerArcs = () => {
  const parts = [];
  for (let r = 0; r < 3; r++) {
    const radius = 4 + r * 3.2;
    let d = `M${12 - radius} 13C${12 - radius} ${13 - radius * 1.35} ${12 + radius} ${13 - radius * 1.35} ${12 + radius} 13`;
    if (r > 0) d += `L${12 + radius} ${17 + r}`;
    parts.push(<path key={`a${r}`} d={d} />);
  }
  return parts;
};

const SHAPES = {
  home: () => <P d={L(2, 10, 12, 2, 22, 10, 22, 22, 15, 22, 15, 15, 9, 15, 9, 22, 2, 22, 2, 10)} />,
  news: () => [R(3, 3, 18, 19, 2, "a"), R(6, 7, 5, 5, 0, "b"), <path key="c" d={L(14, 7, 18, 7)} />, <path key="d" d={L(14, 11, 18, 11)} />, <path key="e" d={L(6, 16, 18, 16)} />, <path key="f" d={L(6, 19, 15, 19)} />],
  trade: () => [<path key="a" d={L(3, 7, 21, 7, 16, 2)} />, <path key="b" d={L(21, 17, 3, 17, 8, 22)} />],
  portfolio: () => [
    <path key="a" d="M11 2C0 2 0 22 11 22C17 22 22 18 22 13L11 13Z" />,
    <path key="b" d="M15 1L15 9L23 9C22 5 19 2 15 1Z" />,
  ],
  user: () => [C(12, 7, 4, "a"), <path key="b" d="M3 23L3 20C3 12 21 12 21 20L21 23Z" />],
  bars: () => [FR(3, 14, 5, 8, 1.5, "a"), FR(9.5, 9, 5, 13, 1.5, "b"), FR(16, 4, 5, 18, 1.5, "c")],
  search: () => [C(10, 10, 7, "a"), <path key="b" d={L(15, 15, 22, 22)} />],
  chevron: () => <P d={L(9, 5, 16, 12, 9, 19)} />,
  down: () => <P d={L(5, 9, 12, 16, 19, 9)} />,
  up: () => <P d={L(5, 15, 12, 8, 19, 15)} />,
  close: () => [<path key="a" d={L(6, 6, 18, 18)} />, <path key="b" d={L(18, 6, 6, 18)} />],
  history: () => [C(12, 12, 9, "a"), <path key="b" d={L(12, 6, 12, 12, 17, 15)} />, <path key="c" d={L(2, 3, 2, 8, 7, 8)} />],
  bell: () => [<path key="a" d="M3 18L5 15L5 9C5 0 19 0 19 9L19 15L21 18Z" />, <path key="b" d={L(10, 22, 14, 22)} />],
  orders: () => [R(4, 2, 16, 21, 2, "a"), <path key="b" d={L(8, 7, 16, 7)} />, <path key="c" d={L(8, 12, 14, 12)} />, <path key="d" d={L(8, 17, 12, 17)} />],
  deposit: () => [<path key="a" d={L(3, 15, 3, 22, 21, 22, 21, 15)} />, <path key="b" d={L(12, 2, 12, 16)} />, <path key="c" d={L(6, 10, 12, 16, 18, 10)} />],
  withdraw: () => [<path key="a" d={L(3, 15, 3, 22, 21, 22, 21, 15)} />, <path key="b" d={L(12, 16, 12, 2)} />, <path key="c" d={L(6, 8, 12, 2, 18, 8)} />],
  calendar: () => [R(3, 5, 18, 17, 2, "a"), <path key="b" d={L(7, 2, 7, 8)} />, <path key="c" d={L(17, 2, 17, 8)} />, <path key="d" d={L(3, 11, 21, 11)} />, FC(8, 15, 1, "e"), FC(15, 15, 1, "f"), FC(8, 19, 1, "g")],
  check: () => <P d={L(4, 12, 10, 18, 21, 5)} />,
  "arrow-down": () => [<path key="a" d={L(12, 3, 12, 21)} />, <path key="b" d={L(5, 14, 12, 21, 19, 14)} />],
  "arrow-up": () => [<path key="a" d={L(12, 21, 12, 3)} />, <path key="b" d={L(5, 10, 12, 3, 19, 10)} />],
  eye: () => [<path key="a" d="M1.5 12C6 4.5 18 4.5 22.5 12C18 19.5 6 19.5 1.5 12Z" />, C(12, 12, 3.4, "b")],
  "eye-off": () => [<path key="a" d="M1.5 12C6 4.5 18 4.5 22.5 12" />, <path key="b" d={L(4, 4, 20, 20)} />, <path key="c" d={L(9, 14.5, 12, 15.5, 15, 14.5)} />],
  lock: () => [R(4, 10.5, 16, 11, 2.5, "a"), <path key="b" d="M8 10.5L8 7.5C8 2 16 2 16 7.5L16 10.5" />, FC(12, 16, 1.4, "c")],
  bank: () => [<path key="a" d={L(2, 9, 12, 3, 22, 9)} />, <path key="b" d={L(2, 21, 22, 21)} />, <path key="c" d={L(6, 11, 6, 19)} />, <path key="d" d={L(12, 11, 12, 19)} />, <path key="e" d={L(18, 11, 18, 19)} />],
  card: () => [R(2, 5, 20, 14, 3, "a"), <path key="b" d={L(2, 10, 22, 10)} />, <path key="c" d={L(6, 15, 10, 15)} />],
  question: () => [C(12, 12, 9.5, "a"), <path key="b" d="M8.8 9.5C8.8 5.8 15.2 5.8 15.2 9.5C15.2 12.2 12 12.4 12 15.2" />, FC(12, 18.3, 1.1, "c")],
  info: () => [C(12, 12, 9.5, "a"), <path key="b" d={L(12, 11, 12, 17)} />, FC(12, 7.4, 1.1, "c")],
  sun: () => [
    C(12, 12, 4.6, "a"),
    <path key="b" d={L(12, 1.6, 12, 4.2)} />, <path key="c" d={L(12, 19.8, 12, 22.4)} />,
    <path key="d" d={L(1.6, 12, 4.2, 12)} />, <path key="e" d={L(19.8, 12, 22.4, 12)} />,
    <path key="f" d={L(4.6, 4.6, 6.4, 6.4)} />, <path key="g" d={L(17.6, 17.6, 19.4, 19.4)} />,
    <path key="h" d={L(19.4, 4.6, 17.6, 6.4)} />, <path key="i" d={L(6.4, 17.6, 4.6, 19.4)} />,
  ],
  moon: () => <P d="M20.6 15.1C12.4 18.6 5.2 11.4 8.7 3.2C3.1 5.2 0.7 12.5 4.7 17.8C8.5 22.9 17.5 21.6 20.6 15.1Z" />,
  shield: () => [<path key="a" d={L(12, 1, 21, 5, 20, 15, 12, 23, 4, 15, 3, 5, 12, 1)} />, <path key="b" d={L(7, 11, 11, 15, 17, 8)} />],
  trend: () => [<path key="a" d={L(2, 17, 8.5, 10.5, 13.5, 15.5, 22, 7)} />, <path key="b" d={L(16, 7, 22, 7, 22, 13)} />],
  "trend-down": () => [<path key="a" d={L(2, 7, 8.5, 13.5, 13.5, 8.5, 22, 17)} />, <path key="b" d={L(16, 17, 22, 17, 22, 11)} />],
  list: () => [FC(4.5, 6, 1.5, "a"), FC(4.5, 12, 1.5, "b"), FC(4.5, 18, 1.5, "c"), <path key="d" d={L(9, 6, 21, 6)} />, <path key="e" d={L(9, 12, 21, 12)} />, <path key="f" d={L(9, 18, 21, 18)} />],
  grid: () => [R(3, 3, 7.5, 7.5, 1.5, "a"), R(13.5, 3, 7.5, 7.5, 1.5, "b"), R(3, 13.5, 7.5, 7.5, 1.5, "c"), R(13.5, 13.5, 7.5, 7.5, 1.5, "d")],
  table: () => [R(3, 4, 18, 16, 2, "a"), <path key="b" d={L(3, 9.5, 21, 9.5)} />, <path key="c" d={L(9.5, 9.5, 9.5, 20)} />, <path key="d" d={L(9.5, 14.75, 21, 14.75)} />],
  sort: () => [<path key="a" d={L(8, 19, 8, 5)} />, <path key="b" d={L(4.5, 8.5, 8, 5, 11.5, 8.5)} />, <path key="c" d={L(16, 5, 16, 19)} />, <path key="d" d={L(12.5, 15.5, 16, 19, 19.5, 15.5)} />],
  sliders: () => [<path key="a" d={L(3, 6, 21, 6)} />, <path key="b" d={L(3, 12, 21, 12)} />, <path key="c" d={L(3, 18, 21, 18)} />, FC(15, 6, 2.3, "d"), FC(8, 12, 2.3, "e"), FC(17, 18, 2.3, "f")],
  star: () => <P d="M12 2.5L14.7 8.78L21.51 9.41L16.37 13.92L17.88 20.59L12 17.1L6.12 20.59L7.63 13.92L2.49 9.41L9.3 8.78Z" />,
  "star-filled": () => <F d="M12 2.5L14.7 8.78L21.51 9.41L16.37 13.92L17.88 20.59L12 17.1L6.12 20.59L7.63 13.92L2.49 9.41L9.3 8.78Z" />,
  headset: () => [<path key="a" d="M4 14L4 12C4 2 20 2 20 12L20 14" />, R(3, 13, 4.5, 7, 1.5, "b"), R(16.5, 13, 4.5, 7, 1.5, "c")],
  gear: () => [C(12, 12, 3.2, "a"), ...gearTeeth(), C(12, 12, 6.3, "z")],
  logout: () => [<path key="a" d={L(9.5, 3, 5, 3, 5, 21, 9.5, 21)} />, <path key="b" d={L(16, 7, 21, 12, 16, 17)} />, <path key="c" d={L(21, 12, 10, 12)} />],
  palette: () => [
    <path key="a" d="M12 2.5C6.5 2.5 2.5 6.8 2.5 12C2.5 17.2 6.5 21.5 12 21.5C13.8 21.5 14.6 20.3 14.2 19C13.7 17.4 14.8 16 16.5 16L18.4 16C20.2 16 21.5 14.6 21.5 12.6C21.5 7 17.2 2.5 12 2.5Z" />,
    FC(7.5, 11, 1.5, "b"), FC(10.5, 6.8, 1.5, "c"), FC(15.5, 7.2, 1.5, "d"), FC(17.6, 11.4, 1.5, "e"),
  ],
  globe: () => [C(12, 12, 9.5, "a"), <ellipse key="b" cx="12" cy="12" rx="4" ry="9.5" />, <path key="c" d={L(2.5, 12, 21.5, 12)} />],
  percent: () => [<path key="a" d={L(19, 5, 5, 19)} />, C(7, 7, 2.6, "b"), C(17, 17, 2.6, "c")],
  fingerprint: () => [...fingerArcs(), <path key="z" d={L(12, 11, 12, 21)} />],
  back: () => [<path key="a" d={L(19, 12, 5, 12)} />, <path key="b" d={L(11, 6, 5, 12, 11, 18)} />],
  phone: () => [R(7, 2, 10, 20, 2.5, "a"), <path key="b" d={L(11, 18.5, 13, 18.5)} />],
  laptop: () => [R(4, 4.5, 16, 11.5, 2, "a"), <path key="b" d={L(2, 19.5, 22, 19.5)} />],
  clock: () => [C(12, 12, 9.5, "a"), <path key="b" d={L(12, 7, 12, 12.5, 16, 14.5)} />],
  message: () => <P d="M6 4L18 4C20.2 4 21.5 5.3 21.5 7.5L21.5 13.5C21.5 15.7 20.2 17 18 17L10 17L5.5 21L5.5 17C3.8 16.6 2.5 15.3 2.5 13.5L2.5 7.5C2.5 5.3 3.8 4 6 4Z" />,
  swap: () => [<path key="a" d={L(3, 8, 17, 8)} />, <path key="b" d={L(13, 4, 17, 8, 13, 12)} />, <path key="c" d={L(21, 16, 7, 16)} />, <path key="d" d={L(11, 12, 7, 16, 11, 20)} />],
  wallet: () => [
    R(2.5, 5.5, 19, 14, 3, "a"),
    <path key="b" d={L(6.5, 5.5, 6.5, 3.5, 17.5, 3.5, 17.5, 5.5)} />,
    <path key="c" d="M21.5 10L16.5 10C14.5 10 14.5 15 16.5 15L21.5 15" />,
    FC(17.2, 12.5, 1.2, "d"),
  ],
  plus: () => [<path key="a" d={L(12, 4, 12, 20)} />, <path key="b" d={L(4, 12, 20, 12)} />],
  trash: () => [<path key="a" d={L(4, 6, 20, 6)} />, <path key="b" d={L(9, 6, 9, 3.5, 15, 3.5, 15, 6)} />, R(6, 6, 12, 16, 2, "c"), <path key="d" d={L(10, 10, 10, 18)} />, <path key="e" d={L(14, 10, 14, 18)} />],
  link: () => [<path key="a" d="M10 14C11.5 15.5 14 15.5 15.5 14L19 10.5C20.5 9 20.5 6.5 19 5C17.5 3.5 15 3.5 13.5 5L11.8 6.7" />, <path key="b" d="M14 10C12.5 8.5 10 8.5 8.5 10L5 13.5C3.5 15 3.5 17.5 5 19C6.5 20.5 9 20.5 10.5 19L12.2 17.3" />],
  download: () => [<path key="a" d={L(12, 3, 12, 16)} />, <path key="b" d={L(6, 10, 12, 16, 18, 10)} />, <path key="c" d={L(3, 20, 21, 20)} />],
  apple: () => [<path key="a" d="M16.3 12.6C16.3 9.9 18.5 8.7 18.6 8.6C17.4 6.8 15.5 6.6 14.8 6.5C13.2 6.4 11.6 7.5 10.8 7.5C10 7.5 8.7 6.5 7.3 6.6C5.5 6.6 3.9 7.6 3 9.3C1.2 12.5 2.5 17.2 4.3 19.8C5.2 21.1 6.2 22.5 7.6 22.4C8.9 22.4 9.4 21.6 11 21.6C12.6 21.6 13 22.4 14.4 22.4C15.9 22.3 16.8 21.1 17.6 19.8C18.6 18.3 19 16.9 19 16.8C19 16.8 16.3 15.7 16.3 12.6Z" />, <path key="b" d="M13.8 4.9C14.5 4 15 2.8 14.9 1.6C13.9 1.6 12.6 2.3 11.9 3.1C11.3 3.8 10.7 5.1 10.8 6.2C12 6.3 13.1 5.7 13.8 4.9Z" />],
  android: () => [<path key="a" d="M4 17L4 11C4 6.6 7.6 3 12 3C16.4 3 20 6.6 20 11L20 17Z" />, <path key="b" d={L(6.5, 3.5, 8.5, 6.5)} />, <path key="c" d={L(17.5, 3.5, 15.5, 6.5)} />, FC(8.8, 10.5, 1.1, "d"), FC(15.2, 10.5, 1.1, "e")],
  gift: () => [R(3, 9, 18, 12, 2, "a"), <path key="b" d={L(3, 13.5, 21, 13.5)} />, <path key="c" d={L(12, 9, 12, 21)} />, <path key="d" d="M12 9C12 9 10.5 4 8 4C6.3 4 5.5 5.2 5.5 6.4C5.5 8 7 9 12 9Z" />, <path key="e" d="M12 9C12 9 13.5 4 16 4C17.7 4 18.5 5.2 18.5 6.4C18.5 8 17 9 12 9Z" />],
};

export default function Icon({ name, size = 21, color, className = "", style }) {
  const shape = SHAPES[name];
  if (!shape) return <span className="glyph-missing" style={{ width: size, height: size, display: "inline-block" }} />;
  return (
    <svg
      className={`glyph ${className}`}
      width={size}
      height={size}
      viewBox="2 2 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color, overflow: "visible", flex: "none", ...style }}
      aria-hidden="true"
    >
      {shape()}
    </svg>
  );
}

export const hasIcon = (name) => Boolean(SHAPES[name]);
