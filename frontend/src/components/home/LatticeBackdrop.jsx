// Decorative scientific ambient backdrop from the Stitch design: hexagonal
// atomic lattice pattern with radial fade mask and soft glow sphere.
export default function LatticeBackdrop() {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply flex items-center justify-center">
        <svg className="w-full h-full" fill="none" viewBox="0 0 1440 680" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <pattern height="103.92" id="hex-lattice" patternTransform="scale(1.2)" patternUnits="userSpaceOnUse" width="60">
              <path d="M30 0 L60 17.32 L60 51.96 L30 69.28 L0 51.96 L0 17.32 Z" fill="none" stroke="#5bb8fe" strokeOpacity="0.35" strokeWidth="0.75" />
              <path d="M30 69.28 L60 86.6 L60 121.24 L30 138.56 L0 121.24 L0 86.6 Z" fill="none" stroke="#006398" strokeOpacity="0.25" strokeWidth="0.5" />
              <circle cx="30" cy="17.32" fill="#006398" fillOpacity="0.4" r="2.5" />
              <circle cx="60" cy="51.96" fill="#5bb8fe" fillOpacity="0.5" r="2" />
              <circle cx="0" cy="51.96" fill="#5bb8fe" fillOpacity="0.5" r="2" />
              <circle cx="30" cy="69.28" fill="#069669" fillOpacity="0.35" r="2.5" />
            </pattern>
            <radialGradient cx="50%" cy="35%" id="lattice-fade" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <mask id="fade-mask">
              <rect fill="url(#lattice-fade)" height="100%" width="100%" />
            </mask>
          </defs>
          <rect fill="url(#hex-lattice)" height="100%" mask="url(#fade-mask)" width="100%" />
        </svg>
      </div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-secondary-container/20 rounded-full blur-3xl pointer-events-none -z-0" />
    </>
  )
}
