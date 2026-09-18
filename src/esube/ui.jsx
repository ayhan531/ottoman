// APK'daki UI/Design.cs yardımcılarının web karşılığı.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./icons.jsx";
import { T } from "./lang.js";

/* ---------- sembol rozeti (UI/Logo.cs) ---------- */

export function Symbol({ logo, letter, size = 34, tinted = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38 * 10) / 10 };
  if (!logo || failed) {
    return <span className="symbol" style={style}>{(letter || "?").slice(0, 1)}</span>;
  }
  return (
    <span className={`symbol${tinted ? " tinted" : ""}`} style={style}>
      <img src={logo} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

/* ---------- arama kutusu ---------- */

export function SearchBox({ placeholder, value, onChange, inputRef }) {
  return (
    <label className="searchbox">
      <Icon name="search" size={21} />
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        spellCheck="false"
      />
      {value ? (
        <button type="button" className="clear" onClick={() => onChange("")} aria-label={T("Temizle")}>
          <Icon name="close" size={16} />
        </button>
      ) : <span />}
    </label>
  );
}

/* ---------- yatay sekme şeridi ---------- */

export function Segments({ titles, active, onSelect }) {
  const wrap = useRef(null);
  const items = useRef([]);
  // Etkin sekme görünür kalsın; liste yenilenince şerit başa atmasın.
  useLayoutEffect(() => {
    const node = items.current[active];
    const box = wrap.current;
    if (!node || !box) return;
    const left = node.offsetLeft;
    const right = left + node.offsetWidth;
    if (left < box.scrollLeft + 8) box.scrollLeft = Math.max(0, left - 16);
    else if (right > box.scrollLeft + box.clientWidth - 8) box.scrollLeft = right - box.clientWidth + 16;
  }, [active]);
  return (
    <div className="mseg-wrap">
      <div className="mseg" ref={wrap}>
        {titles.map((title, index) => (
          <button
            key={title}
            ref={(node) => { items.current[index] = node; }}
            className={index === active ? "active" : ""}
            onClick={() => onSelect(index)}
          >
            {title}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- anahtar ---------- */

export const Toggle = ({ on, onChange }) => (
  <button type="button" className={`toggle${on ? " on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}>
    <i />
  </button>
);

/* ---------- katman: alttan sayfa / ortalanmış kutu / açılır kart ---------- */

export function Overlay({ onClose, children, className = "" }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [onClose]);
  return createPortal(
    <div className={`overlay ${className}`}>
      <div className="backdrop" onClick={onClose} />
      {children}
    </div>,
    document.body
  );
}

export function Sheet({ title, onClose, children, closable = true }) {
  return (
    <Overlay onClose={onClose}>
      <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
        <div className="shandle" />
        <div className="sheet-stack">
          {closable ? (
            <div className="rowline">
              {typeof title === "string" ? <div className="sheet-title">{title}</div> : title}
              <button className="icon-btn soft sm" onClick={onClose} aria-label={T("Kapat")}><Icon name="close" size={18} /></button>
            </div>
          ) : title}
          {children}
        </div>
      </div>
    </Overlay>
  );
}

export function Dialog({ title, onClose, children, closable = true, center = false }) {
  return (
    <Overlay onClose={onClose}>
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-stack">
          {closable ? (
            <div className="rowline">
              {typeof title === "string" ? <div className={`sheet-title${center ? " center" : ""}`}>{title}</div> : title}
              <button className="icon-btn soft sm" onClick={onClose} aria-label={T("Kapat")}><Icon name="close" size={18} /></button>
            </div>
          ) : (typeof title === "string" ? <div className={`sheet-title${center ? " center" : ""}`}>{title}</div> : title)}
          {children}
        </div>
      </div>
    </Overlay>
  );
}

/* ---------- seçenek listesi (Design.Choices) ---------- */

export function Choices({ names, selected, onChoose }) {
  return (
    <div>
      {names.map((name, index) => (
        <React.Fragment key={name}>
          {index > 0 && <div className="hline" />}
          <button className={`choice-row${index === selected ? " on" : ""}`} onClick={() => onChoose(index)}>
            <span>{name}</span>
            {index === selected ? <Icon name="check" size={18} /> : <span />}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- ayraçlı liste ---------- */

export function Divided({ children, className = "" }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div className={className}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 && <div className="hline" />}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- halka grafik (UI/Donut.cs) ---------- */

export function Donut({ parts, center, size = 76, track = "rgba(255,255,255,.22)", ink = "#fff" }) {
  const thickness = size * 0.17;
  const radius = (size - thickness) / 2 - 1;
  const cx = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: "none" }}>
      <circle cx={cx} cy={cx} r={radius} fill="none" stroke={track} strokeWidth={thickness} />
      <g transform={`rotate(-90 ${cx} ${cx})`}>
        {parts.map(([share, color], index) => {
          const length = Math.max(0, Math.min(1, share)) * circumference;
          const dash = `${length} ${circumference - length}`;
          const node = (
            <circle
              key={index}
              cx={cx} cy={cx} r={radius}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return length > 1 ? node : null;
        })}
      </g>
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central" fill={ink} fontSize={size * 0.22} fontWeight="700">
        {center}
      </text>
    </svg>
  );
}

/* ---------- kıvılcım çizgi (UI/Spark.cs) ---------- */

export function Spark({ points, line, fill, upBubble, downBubble, bubbleInk = "#0E3B2E", height = 120 }) {
  const box = useRef(null);
  const [width, setWidth] = useState(220);
  const [selected, setSelected] = useState(points.length - 1);
  useEffect(() => setSelected(points.length - 1), [points.length]);
  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth || 220));
    observer.observe(node);
    setWidth(node.clientWidth || 220);
    return () => observer.disconnect();
  }, []);

  const TOP = 30, BOTTOM = 4, LEFT = 4, RIGHT = 8;
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const w = Math.max(40, width - LEFT - RIGHT);
    const h = Math.max(24, height - TOP - BOTTOM);
    let min = Math.min(...points.map((p) => p.value));
    let max = Math.max(...points.map((p) => p.value));
    if (max - min < 0.01) { max += 0.5; min -= 0.5; }
    const at = (i) => ({ x: LEFT + (w * i) / (points.length - 1), y: TOP + h - ((points[i].value - min) / (max - min)) * h });
    let d = `M${at(0).x} ${at(0).y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = at(Math.max(i - 1, 0)), p1 = at(i), p2 = at(i + 1), p3 = at(Math.min(i + 2, points.length - 1));
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += `C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
    }
    const area = `${d}L${at(points.length - 1).x} ${height}L${at(0).x} ${height}Z`;
    return { at, d, area, w };
  }, [points, width, height]);

  if (!geometry) return <div ref={box} style={{ height }} />;

  const pick = (clientX) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(clientX - rect.left, LEFT), width - RIGHT);
    const index = Math.round(((x - LEFT) / geometry.w) * (points.length - 1));
    setSelected(Math.min(Math.max(index, 0), points.length - 1));
  };

  const point = geometry.at(selected);
  const day = points[selected];
  const text = `${day.date} · ${day.label}`;
  const bw = text.length * 6.2 + 18;
  const bh = 22;
  const bx = Math.min(Math.max(point.x - bw / 2, 0), Math.max(0, width - bw));
  const by = Math.max(point.y - 11 - bh, 0);

  return (
    <div ref={box} style={{ height, position: "relative" }}>
      <svg
        className="spark"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pick(event.clientX); }}
        onPointerMove={(event) => { if (event.buttons) pick(event.clientX); }}
      >
        <path d={geometry.area} fill={fill} />
        <path d={geometry.d} fill="none" stroke={line} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={point.x} y1={point.y + 8} x2={point.x} y2={height} stroke="rgba(255,255,255,.35)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={point.x} cy={point.y} r="5.5" fill="#fff" />
        <circle cx={point.x} cy={point.y} r="3.5" fill={line} />
        <rect x={bx} y={by} width={bw} height={bh} rx="8" fill={day.up ? upBubble : downBubble} />
        <path d={`M${point.x - 5} ${by + bh}L${point.x + 5} ${by + bh}L${point.x} ${by + bh + 5}Z`} fill={day.up ? upBubble : downBubble} />
        <text x={bx + bw / 2} y={by + bh / 2} textAnchor="middle" dominantBaseline="central" fill={bubbleInk} fontSize="11.5" fontWeight="700">
          {text}
        </text>
      </svg>
    </div>
  );
}

/* ---------- geri oklu başlıklar ---------- */

export const CenteredHeader = ({ title, onBack }) => (
  <div className={`page-head center${String(title).length > 28 ? " long" : ""}`}>
    <button className="icon-btn" onClick={onBack} aria-label={T("Geri")}><Icon name="back" size={21} /></button>
    <h1>{title}</h1>
    <span />
  </div>
);

export const PageHeader = ({ title, onBack, tail }) => (
  <div className="page-head with-tail">
    <button className="icon-btn" onClick={onBack} aria-label={T("Geri")}><Icon name="back" size={21} /></button>
    <h1 style={{ textAlign: "left", fontSize: String(title).length > 24 ? "calc(18px * var(--s))" : undefined }}>{title}</h1>
    {tail || <span />}
  </div>
);

export { Icon };
