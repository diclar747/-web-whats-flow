import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

const WinsapLogo: React.FC<SvgIconProps> = (props) => {
    return (
        <SvgIcon {...props} viewBox="0 0 512 512">
            <defs>
                <linearGradient id="winsapCorporateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00d2ff" />
                    <stop offset="100%" stopColor="#32CD32" />
                </linearGradient>
            </defs>

            {/* 
                Corporate "3 Pillars" W Design
                Three dynamic, slanted pillars with rounded caps
            */}

            {/* Left Pillar */}
            <rect
                x="80"
                y="120"
                width="70"
                height="272"
                rx="35"
                fill="url(#winsapCorporateGradient)"
                transform="rotate(-15, 115, 256)"
                opacity="0.7"
            />

            {/* Middle Pillar */}
            <rect
                x="221"
                y="160"
                width="70"
                height="192"
                rx="35"
                fill="url(#winsapCorporateGradient)"
                transform="rotate(-15, 256, 256)"
                opacity="0.9"
            />

            {/* Right Pillar */}
            <rect
                x="362"
                y="120"
                width="70"
                height="272"
                rx="35"
                fill="url(#winsapCorporateGradient)"
                transform="rotate(-15, 397, 256)"
            />

            <path
                d="M100 400 Q 256 460, 412 400"
                fill="none"
                stroke="url(#winsapCorporateGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                opacity="0.3"
            />
        </SvgIcon>
    );
};

export default WinsapLogo;
