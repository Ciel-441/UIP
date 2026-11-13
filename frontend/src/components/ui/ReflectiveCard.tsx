'use client';

import React, { useMemo } from 'react';
import './ReflectiveCard.css';
import { Fingerprint, Activity } from 'lucide-react';

interface ReflectiveCardProps {
  blurStrength?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  overlayColor?: string;
  displacementStrength?: number;
  noiseScale?: number;
  specularConstant?: number;
  grayscale?: number;
  glassDistortion?: number;
  className?: string;
  style?: React.CSSProperties;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  userPfp?: string | null;
  userStatus?: string;
  joinedDate?: string;
  userRoomRole?: string | null;
}

const ReflectiveCard: React.FC<ReflectiveCardProps> = ({
  blurStrength = 12,
  color = 'white',
  metalness = 1,
  roughness = 0.4,
  overlayColor = 'rgba(255, 255, 255, 0.1)',
  displacementStrength = 20,
  noiseScale = 1,
  specularConstant = 1.2,
  grayscale = 1,
  glassDistortion = 0,
  className = '',
  style = {},
  userName = 'ALEXANDER DOE',
  userRole = 'SENIOR DEVELOPER',
  userEmail = 'alexander.doe@example.com',
  userPfp = null,
  userStatus = 'online',
  joinedDate = '',
  userRoomRole = null
}) => {
  const baseFrequency = 0.03 / Math.max(0.1, noiseScale);
  const saturation = 1 - Math.max(0, Math.min(1, grayscale));

  const cssVariables = {
    '--blur-strength': `${blurStrength}px`,
    '--metalness': metalness,
    '--roughness': roughness,
    '--overlay-color': overlayColor,
    '--text-color': color,
    '--saturation': saturation
  } as React.CSSProperties;

  const formattedJoinedDate = useMemo(() => {
    if (!joinedDate) return 'N/A';
    try {
      const date = new Date(joinedDate);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  }, [joinedDate]);

  const roleClass = `role-${userRole.toLowerCase().replace(/\s+/g, '-')}`;
  const statusLower = userStatus.toLowerCase();

  return (
    <div className={`reflective-card-container ${className}`} style={{ ...style, ...cssVariables }}>
      <svg className="reflective-svg-filters" aria-hidden="true">
        <defs>
          <filter id="metallic-displacement" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="turbulence" baseFrequency={baseFrequency} numOctaves={2} result="noise" />
            <feColorMatrix in="noise" type="luminanceToAlpha" result="noiseAlpha" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={displacementStrength}
              xChannelSelector="R"
              yChannelSelector="G"
              result="rippled"
            />
            <feSpecularLighting
              in="noiseAlpha"
              surfaceScale={displacementStrength}
              specularConstant={specularConstant}
              specularExponent="20"
              lightingColor="#ffffff"
              result="light"
            >
              <fePointLight x={0} y={0} z={300} />
            </feSpecularLighting>
            <feComposite in="light" in2="rippled" operator="in" result="light-effect" />
            <feBlend in="light-effect" in2="rippled" mode="screen" result="metallic-result" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="solidAlpha"
            />
            <feMorphology in="solidAlpha" operator="erode" radius="45" result="erodedAlpha" />
            <feGaussianBlur in="erodedAlpha" stdDeviation="10" result="blurredMap" />
            <feComponentTransfer in="blurredMap" result="glassMap">
              <feFuncA type="linear" slope="0.5" intercept="0" />
            </feComponentTransfer>
            <feDisplacementMap
              in="metallic-result"
              in2="glassMap"
              scale={glassDistortion}
              xChannelSelector="A"
              yChannelSelector="A"
              result="final"
            />
          </filter>
        </defs>
      </svg>

      {userPfp ? (
        <img src={userPfp} alt="User Profile" className="reflective-video" />
      ) : (
        <div className="reflective-video-fallback reflective-video" />
      )}

      <div className="reflective-noise" />
      <div className="reflective-sheen" />
      <div className="reflective-border" />

      <div className="reflective-content">
        <div className="card-header">
          <div className={`status-badge status-${statusLower}`}>
            <span className="status-dot" />
            <span>{userStatus.toUpperCase()}</span>
          </div>
          {userRoomRole ? (
            <div className={`room-role-badge role-${userRoomRole.toLowerCase()}`}>
              <span>{userRoomRole.toUpperCase()}</span>
            </div>
          ) : (
            <Activity className="status-icon animate-pulse" size={20} />
          )}
        </div>

        <div className="card-body">
          <div className="user-info">
            <h2 className="user-name">{userName}</h2>
            <p className={`user-role ${roleClass}`}>{userRole}</p>
          </div>
        </div>

        <div className="card-footer">
          <div className="id-section">
            <span className="label">EMAIL</span>
            <span className="value text-xs truncate max-w-[180px]" title={userEmail}>{userEmail}</span>
            <span className="label mt-2">MEMBER SINCE</span>
            <span className="value text-xs">{formattedJoinedDate}</span>
          </div>
          <div className="fingerprint-section">
            <Fingerprint size={32} className="fingerprint-icon" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReflectiveCard;
