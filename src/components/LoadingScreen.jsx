import { useState, useEffect } from 'react';
import './LoadingScreen.css';

export default function LoadingScreen({ onFinish }) {
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setFadeOut(true), 2000);
        const removeTimer = setTimeout(() => onFinish(), 2800);
        return () => {
            clearTimeout(timer);
            clearTimeout(removeTimer);
        };
    }, [onFinish]);

    return (
        <div className={`loading-screen ${fadeOut ? 'fade-out' : ''}`}>
            <div className="loading-bg-orbs">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>
            <div className="loading-content">
                <div className="loading-logo">
                    <div className="logo-icon">
                        <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M30 5 L53 18 V42 L30 55 L7 42 V18 L30 5Z" stroke="url(#logoGrad)" strokeWidth="3.5" strokeLinejoin="round" />
                            <path d="M22 25 L30 33 L38 25" stroke="url(#logoGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M30 33 V45" stroke="url(#logoGrad)" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="30" cy="12" r="2" fill="url(#logoGrad)" />
                            <defs>
                                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#ffffff" />
                                    <stop offset="50%" stopColor="#a8b0c8" />
                                    <stop offset="100%" stopColor="#818cf8" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1 className="loading-title">WiseVault</h1>
                </div>
                <p className="loading-tagline">Download anything. Anywhere.</p>
                <div className="loading-bar">
                    <div className="loading-bar-fill" />
                </div>
            </div>
        </div>
    );
}
