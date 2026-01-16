import React, { useEffect, useRef, useState } from 'react';

interface AutoFitTextProps {
    children: React.ReactNode | string;
    maxFontSize: number;
    minFontSize?: number;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}

const AutoFitText: React.FC<AutoFitTextProps> = ({ children, maxFontSize, minFontSize = 12, className, style, title }) => {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [fontSize, setFontSize] = useState<number>(maxFontSize);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let current = maxFontSize;
        const fit = () => {
            // Ensure the element fills the available width so measurements are correct
            el.style.width = '100%';
            el.style.boxSizing = 'border-box';
            el.style.whiteSpace = 'nowrap'; // try single-line first

            // Reset to max and iteratively reduce until it fits or reaches min
            current = maxFontSize;
            el.style.fontSize = `${current}px`;
            // Loop with a safe limit
            let guard = 0;
            // Use bounding width for more reliable measurement
            const targetWidth = Math.max(el.clientWidth, el.parentElement ? el.parentElement.getBoundingClientRect().width : 0);

            while (current > (minFontSize || 12) && el.scrollWidth > targetWidth + 1 && guard < 500) {
                current -= 1;
                el.style.fontSize = `${current}px`;
                guard += 1;
            }

            // If we reached minimum size and still overflowing, allow wrapping as a fallback
            if (current <= (minFontSize || 12) && el.scrollWidth > targetWidth + 1) {
                el.style.whiteSpace = 'normal';
            }

            setFontSize(current);
        };

        // Initial fit attempts (try multiple frames to wait for layout)
        requestAnimationFrame(fit);
        setTimeout(fit, 0);
        setTimeout(fit, 80);

        // Observe both the element and its parent for size changes
        const ro = (window as any).ResizeObserver ? new (window as any).ResizeObserver(fit) : null;
        if (ro) {
            ro.observe(el);
            if (el.parentElement) ro.observe(el.parentElement);
        }
        window.addEventListener('resize', fit);

        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener('resize', fit);
        };
    }, [children, maxFontSize, minFontSize]);

    return (
        <span
            ref={ref}
            className={className}
            style={{ ...style, fontSize, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={title}
        >
            {children}
        </span>
    );
};

export default AutoFitText;
