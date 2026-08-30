// Capacitor 8's Android SystemBars plugin updates --safe-area-inset-* whenever
// system bars, the display cutout, rotation, or the IME changes. Keep the
// existing app-wide variable names while using env() as the iOS/web fallback.
for (const side of ['top', 'right', 'bottom', 'left']) {
  document.documentElement.style.setProperty(
    `--mobile-safe-area-inset-${side}`,
    `var(--safe-area-inset-${side}, env(safe-area-inset-${side}, 0px))`
  )
}

export {}
