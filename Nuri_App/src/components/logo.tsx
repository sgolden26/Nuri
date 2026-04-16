import React from "react";

const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg
        width="40"
        height="40"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Nuri logo"
        {...props}
    >
        <defs>
            <linearGradient id="nuri-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#064e3b" />
                <stop offset="100%" stopColor="#115e59" />
            </linearGradient>
            <linearGradient id="nuri-leaf" x1="50" y1="84" x2="50" y2="12" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
        </defs>

        <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#nuri-bg)" />

        <path
            d="M50 84
               C65 71, 70 53, 66 38
               Q61 22, 50 12
               Q39 22, 34 38
               C30 53, 35 71, 50 84Z"
            fill="url(#nuri-leaf)"
        />

        <line
            x1={50} y1={79} x2={50} y2={19}
            stroke="#fff"
            strokeWidth={3}
            opacity={0.85}
            strokeLinecap="round"
        />

        <path d="M50 65 Q58 57 66 49" stroke="#fff" strokeWidth={2.5} opacity={0.65} fill="none" strokeLinecap="round" />
        <path d="M50 49 Q56 42 63 35" stroke="#fff" strokeWidth={2} opacity={0.55} fill="none" strokeLinecap="round" />
        <path d="M50 65 Q42 57 34 49" stroke="#fff" strokeWidth={2.5} opacity={0.65} fill="none" strokeLinecap="round" />
        <path d="M50 49 Q44 42 37 35" stroke="#fff" strokeWidth={2} opacity={0.55} fill="none" strokeLinecap="round" />
    </svg>
);

export default Logo;