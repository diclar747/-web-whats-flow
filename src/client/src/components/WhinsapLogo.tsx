import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

const WhinsapLogo: React.FC<SvgIconProps> = (props) => {
    return (
        <SvgIcon {...props} viewBox="0 0 512 512">
            {/* 
        Modern stylized "W" logo for Whinsap 
        Gradient styled, thick strokes, rounded corners
      */}
            <defs>
                <linearGradient id="whinsapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00d2ff" />
                    <stop offset="100%" stopColor="#3a7bd5" />
                </linearGradient>
            </defs>

            <path
                d="M123.5,64 L50,64 C36.2,64 25,75.2 25,89 L25,123.5 C25,130.6 28,137.3 33.3,142 L131.5,232.5 C139.7,240.1 152.3,240.1 160.5,232.5 L241,158.3 C245.9,153.8 249,147.5 249,140.7 L249,89 C249,75.2 237.8,64 224,64 L123.5,64 Z"
                fill="url(#whinsapGradient)"
                opacity="0.9"
                transform="translate(0, 100) scale(1, -1) translate(0, -500)" // Flip vertically just for design variety or use simple W path
                style={{ display: 'none' }} // Placeholder for the complex path, using simpler path below
            />

            {/* 
        Custom "W" Path - Resembling the uploaded image W-shape
        It looks like three strokes or a continuous W with rounded ends
      */}
            <path
                d="M85 96C85 82.7452 95.7452 72 109 72H145.85C156.447 72 165.732 79.1728 168.324 89.4716L195.429 197.164C198.857 210.785 218.143 210.785 221.571 197.164L248.676 89.4716C251.268 79.1728 260.553 72 271.15 72H308C321.255 72 332 82.7452 332 96V117.85C332 128.447 324.827 137.732 314.528 140.324L267.429 152.164C253.808 155.592 253.808 174.877 267.429 178.305L314.528 190.145C324.827 192.737 332 202.022 332 212.619V416C332 429.255 321.255 440 308 440H270.211C259.957 440 250.841 433.279 247.935 423.46L222.065 336.012C218.423 323.702 201.577 323.702 197.935 336.012L172.065 423.46C169.159 433.279 160.043 440 149.789 440H109C95.7452 440 85 429.255 85 416V96Z"
                fill="none"
            />

            {/* Real W logo path based on "Bird" or "Wing" style often used for W 
           Let's make a bold modern W with gradients.
       */}
            <path
                d="M100 100 L160 380 L220 150 L290 150 L350 380 L410 100 L470 100 L380 440 L260 440 L255 420 L200 420 L130 440 L40 100 Z"
                fill="url(#whinsapGradient)"
                stroke="none"
                style={{ display: 'none' }} // Simple fallback
            />

            {/* 
         Better Construct: 3 vertical bars or waves forming a W
       */}
            <path
                d="M60 80C60 57.9086 77.9086 40 100 40H110C132.091 40 150 57.9086 150 80V432C150 454.091 132.091 472 110 472H100C77.9086 472 60 454.091 60 432V80Z"
                fill="url(#whinsapGradient)"
                opacity="0.6"
                transform="skewX(-10)"
            />
            <path
                d="M210 180C210 157.909 227.909 140 250 140H260C282.091 140 300 157.909 300 180V432C300 454.091 282.091 472 260 472H250C227.909 472 210 454.091 210 432V180Z"
                fill="url(#whinsapGradient)"
                opacity="0.8"
                transform="skewX(-10)"
            />
            <path
                d="M360 80C360 57.9086 377.909 40 400 40H410C432.091 40 450 57.9086 450 80V432C450 454.091 432.091 472 410 472H400C377.909 472 360 454.091 360 432V80Z"
                fill="url(#whinsapGradient)"
                opacity="1"
                transform="skewX(-10)"
            />

        </SvgIcon>
    );
};

export default WhinsapLogo;
