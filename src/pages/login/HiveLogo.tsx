// Pointy-top hexagon path centred at (cx, cy) with radius r.
function hex(cx: number, cy: number, r: number) {
  const pts = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

// Three connected cells: top and bottom-left outlined, bottom-right filled.
export function HiveLogo({ className }: { className?: string }) {
  const d = 17.32; // cell spacing for layout radius 10
  const r = 10; // cells touch, sharing edges, like the brand mark
  return (
    <svg viewBox="-19.5 -12 39 39" className={className} aria-hidden="true">
      <g stroke="#FFC400" strokeWidth="2.8" strokeLinejoin="round" fill="none">
        <path d={hex(0, 0, r)} />
        <path d={hex(-d / 2, 15, r)} />
        <path d={hex(d / 2, 15, r)} fill="#FFC400" />
      </g>
    </svg>
  );
}
