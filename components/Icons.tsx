import React from 'react';

const createIcon = (svgContent: React.ReactNode) => 
  React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      ref={ref}
      {...props}
    >
      {svgContent}
    </svg>
  ));

export const GithubIcon = createIcon(
  <>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </>
);

export const Disc3Icon = createIcon(
    <>
        <circle cx="12" cy="12" r="10" />
        <path d="M6 12c0-1.7.7-3.2 1.8-4.2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M18 12c0 1.7-.7 3.2-1.8 4.2" />
    </>
);

export const UploadIcon = createIcon(
    <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" x2="12" y1="3" y2="15" />
    </>
);

export const MusicIcon = createIcon(
    <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </>
);

export const PlayIcon = createIcon(
  <polygon points="5 3 19 12 5 21 5 3" />
);

export const PauseIcon = createIcon(
    <>
        <rect width="4" height="16" x="6" y="4" />
        <rect width="4" height="16" x="14" y="4" />
    </>
);

export const SkipForwardIcon = createIcon(
    <>
        <polygon points="5 4 15 12 5 20 5 4" />
        <line x1="19" x2="19" y1="5" y2="19" />
    </>
);

export const SkipBackIcon = createIcon(
    <>
        <polygon points="19 20 9 12 19 4 19 20" />
        <line x1="5" x2="5" y1="19" y2="5" />
    </>
);

export const Volume2Icon = createIcon(
    <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </>
);

export const TimerIcon = createIcon(
    <>
        <line x1="10" x2="14" y1="2" y2="2" />
        <line x1="12" x2="12" y1="14" y2="18" />
        <path d="M19 11a7 7 0 1 0-7 7" />
        <path d="M12 8v4l2 2" />
    </>
);
