"use client";

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const SplitText = ({
  text = '',
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag = 'p',
  onLetterAnimationComplete = undefined
}) => {
  const containerRef = useRef(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.fonts && document.fonts.status === 'loaded') {
      setFontsLoaded(true);
    } else if (document.fonts) {
      document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    } else {
      setFontsLoaded(true);
    }
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current || !text || !fontsLoaded) return;

      const elements = containerRef.current.querySelectorAll(
        splitType === 'words' ? '.split-word' : '.split-char'
      );

      if (elements.length === 0) return;

      const startPct = (1 - threshold) * 100;
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px';
      const sign =
        marginValue === 0
          ? ''
          : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      const tween = gsap.fromTo(
        elements,
        { ...from },
        {
          ...to,
          duration,
          ease,
          stagger: delay / 1000,
          scrollTrigger: {
            trigger: containerRef.current,
            start,
            once: true,
            fastScrollEnd: true,
            anticipatePin: 0.4
          },
          onComplete: () => {
            onLetterAnimationComplete?.();
          },
          willChange: 'transform, opacity',
          force3D: true
        }
      );

      return () => {
        tween.kill();
        ScrollTrigger.getAll().forEach(st => {
          if (st.trigger === containerRef.current) st.kill();
        });
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded
      ],
      scope: containerRef
    }
  );

  const Tag = tag || 'p';

  const style = {
    textAlign,
    overflow: 'hidden',
    display: 'inline-block',
    whiteSpace: 'normal',
    wordWrap: 'break-word',
    willChange: 'transform, opacity'
  };

  const renderContent = () => {
    if (splitType === 'words') {
      return text.split(' ').map((word, wIdx) => (
        <span
          key={wIdx}
          className="split-word"
          style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
        >
          {word}&nbsp;
        </span>
      ));
    }
    
    return text.split(' ').map((word, wIdx) => (
      <span
        key={wIdx}
        className="split-word"
        style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
      >
        {word.split('').map((char, cIdx) => (
          <span
            key={cIdx}
            className="split-char"
            style={{ display: 'inline-block', willChange: 'transform, opacity' }}
          >
            {char}
          </span>
        ))}
        {wIdx < text.split(' ').length - 1 && (
          <span className="split-char" style={{ display: 'inline-block' }}>
            &nbsp;
          </span>
        )}
      </span>
    ));
  };

  return (
    <Tag ref={containerRef} style={style} className={`split-parent ${className}`}>
      {renderContent()}
    </Tag>
  );
};

export default SplitText;
