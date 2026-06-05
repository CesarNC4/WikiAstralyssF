/**
 * Campo de estrellas determinista y ligero (§6.2). Sin librería: posiciones
 * fijas + twinkle CSS. Server-renderizable (sin random en cliente → sin mismatch).
 * En móvil se reduce la densidad vía `md:` (sólo se muestran las primeras).
 */
const STARS = Array.from({ length: 60 }, (_, i) => {
  // Distribución pseudo-aleatoria determinista basada en el índice.
  const x = (i * 67) % 100;
  const y = (i * 37 + (i % 7) * 11) % 100;
  const size = (i % 3) + 1;
  const delay = (i % 9) * 0.4;
  const dur = 2.5 + (i % 5);
  return { x, y, size, delay, dur, mobile: i < 28 };
});

export function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {STARS.map((s, i) => (
        <span
          key={i}
          className={s.mobile ? "absolute rounded-full bg-white" : "absolute hidden rounded-full bg-white md:block"}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            opacity: 0.5,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
