/**
 * Call-control icons.
 *
 * Drawn here rather than pulled from an icon package: the app needs eight
 * glyphs, and depending on @mui/icons-material for them costs far more than
 * the icons are worth. Rounded strokes to match the rest of the interface.
 */

const Svg = ({ children, ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...props}
    >
        {children}
    </svg>
);

/** Diagonal bar used by every "turned off" variant. */
const Slash = () => <line x1="3.5" y1="3.5" x2="20.5" y2="20.5" />;

export const VideocamIcon = () => (
    <Svg>
        <rect x="2.5" y="6" width="12.5" height="12" rx="3" />
        <path d="M15 11l5-3.2v8.4L15 13z" />
    </Svg>
);

export const VideocamOffIcon = () => (
    <Svg>
        <rect x="2.5" y="6" width="12.5" height="12" rx="3" />
        <path d="M15 11l5-3.2v8.4L15 13z" />
        <Slash />
    </Svg>
);

export const MicIcon = () => (
    <Svg>
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
        <line x1="12" y1="18" x2="12" y2="21.5" />
    </Svg>
);

export const MicOffIcon = () => (
    <Svg>
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
        <line x1="12" y1="18" x2="12" y2="21.5" />
        <Slash />
    </Svg>
);

export const ScreenShareIcon = () => (
    <Svg>
        <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
        <line x1="8" y1="20.5" x2="16" y2="20.5" />
        <path d="M12 13.5V8m0 0l-2.4 2.4M12 8l2.4 2.4" />
    </Svg>
);

export const StopScreenShareIcon = () => (
    <Svg>
        <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
        <line x1="8" y1="20.5" x2="16" y2="20.5" />
        <Slash />
    </Svg>
);

export const ChatIcon = () => (
    <Svg>
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 4v-4A2.5 2.5 0 0 1 3 13.5z" />
    </Svg>
);

export const CallEndIcon = () => (
    <Svg>
        {/* A handset tilted down, the long-standing shorthand for hanging up. */}
        <g transform="rotate(135 12 12)">
            <path d="M6.5 3.5a2 2 0 0 1 2 1.5l.6 2.2a2 2 0 0 1-.5 1.9l-1.2 1.2a12 12 0 0 0 5.3 5.3l1.2-1.2a2 2 0 0 1 1.9-.5l2.2.6a2 2 0 0 1 1.5 2v2.3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 3.2 5.7 2 2 0 0 1 5.2 3.5z" />
        </g>
    </Svg>
);
