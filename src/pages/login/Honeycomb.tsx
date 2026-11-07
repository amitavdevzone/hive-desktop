const clip = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

// [left, top, width] as CSS values; height follows the hexagon ratio.
const cells = [
  ["2%", "-10%", "22vmin"],
  ["-3%", "8%", "24vmin"],
  ["86%", "52%", "26vmin"],
  ["80%", "78%", "20vmin"],
];

// Decorative background hexagons, kept low-contrast per design.md section 8.
export function Honeycomb() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {cells.map(([left, top, width], i) => (
        <div
          key={i}
          className="absolute aspect-[0.866] opacity-70"
          style={{
            left,
            top,
            width,
            clipPath: clip,
            background:
              "radial-gradient(circle at 25% 35%, rgba(255,196,0,0.55), rgba(255,196,0,0.12) 60%, transparent 90%)",
          }}
        />
      ))}
    </div>
  );
}
