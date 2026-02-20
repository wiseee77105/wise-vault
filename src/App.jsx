import { useState, useCallback } from 'react';
import LoadingScreen from './components/LoadingScreen';
import URLInput from './components/URLInput';
import QualitySelector from './components/QualitySelector';
import PlatformCards from './components/PlatformCards';
import ProgressBar from './components/ProgressBar';
import DownloadResult from './components/DownloadResult';
import ErrorMessage from './components/ErrorMessage';
import TechGridBackground from './components/TechGridBackground';
import Footer from './components/Footer';
import { downloadMedia } from './utils/api';
import './App.css';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [state, setState] = useState('idle'); // idle | processing | downloading | success | error
  const [quality, setQuality] = useState('max');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastUrl, setLastUrl] = useState('');

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  const simulateProgress = (startPct, endPct, durationMs) => {
    return new Promise((resolve) => {
      const steps = 20;
      const interval = durationMs / steps;
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const pct = startPct + ((endPct - startPct) * (step / steps));
        setProgress(Math.min(pct, endPct));
        if (step >= steps) {
          clearInterval(timer);
          resolve();
        }
      }, interval);
    });
  };

  const handleSubmit = async (url) => {
    setLastUrl(url);
    setState('processing');
    setError(null);
    setResult(null);
    setProgress(0);
    setStatusText('Menganalisis link...');

    try {
      // Simulate processing phase
      await simulateProgress(0, 30, 800);
      setStatusText('Menghubungkan ke server...');
      await simulateProgress(30, 50, 500);

      setState('downloading');
      setStatusText('Mengunduh konten...');

      // Start actual download
      const progressPromise = simulateProgress(50, 90, 2000);
      const downloadPromise = downloadMedia(url, quality);

      const [, downloadResult] = await Promise.all([progressPromise, downloadPromise]);

      setProgress(100);
      setStatusText('Selesai!');

      // Brief pause to show 100%
      await new Promise((r) => setTimeout(r, 400));

      setResult(downloadResult);
      setState('success');
    } catch (err) {
      setError({ message: err.message, code: err.code || 'PROCESSING_ERROR' });
      setState('error');
    }
  };

  const handleRetry = () => {
    if (lastUrl) {
      handleSubmit(lastUrl);
    }
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setError(null);
    setProgress(0);
    setStatusText('');
    setLastUrl('');
  };

  const isProcessing = state === 'processing' || state === 'downloading';

  return (
    <>
      {showSplash && <LoadingScreen onFinish={handleSplashFinish} />}

      <div className={`app ${showSplash ? 'hidden' : 'visible'}`}>
        <TechGridBackground />

        {/* Main content */}
        <main className="main-content">
          {/* Header */}
          <header className="app-header">
            <div className="app-logo">
              <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-svg">
                <path d="M30 5 L53 18 V42 L30 55 L7 42 V18 L30 5Z" stroke="url(#appLogoGrad)" strokeWidth="3.5" strokeLinejoin="round" />
                <path d="M22 25 L30 33 L38 25" stroke="url(#appLogoGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M30 33 V45" stroke="url(#appLogoGrad)" strokeWidth="3" strokeLinecap="round" />
                <circle cx="30" cy="12" r="2" fill="url(#appLogoGrad)" />
                <defs>
                  <linearGradient id="appLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="50%" stopColor="#A8B0C8" />
                    <stop offset="100%" stopColor="#818CF8" />
                  </linearGradient>
                </defs>
              </svg>
              <h1 className="app-title">WiseVault</h1>
            </div>
            <p className="app-subtitle">
              Download videos, photos & audio from your favorite platforms in HD quality
            </p>
          </header>

          {/* Content area */}
          <div className="content-area">
            {state === 'idle' && (
              <div className="idle-state">
                <URLInput onSubmit={handleSubmit} disabled={false} />
                <div className="quality-section">
                  <QualitySelector quality={quality} onChange={setQuality} disabled={false} />
                </div>
                <PlatformCards />
              </div>
            )}

            {isProcessing && (
              <div className="processing-state">
                <ProgressBar progress={progress} status={statusText} />
              </div>
            )}

            {state === 'success' && (
              <DownloadResult result={result} onReset={handleReset} />
            )}

            {state === 'error' && (
              <ErrorMessage error={error} onRetry={handleRetry} onReset={handleReset} />
            )}
          </div>

          {/* Features */}
          {state === 'idle' && (
            <div className="features-section">
              <div className="feature">
                <span className="feature-icon">🚀</span>
                <span className="feature-text">Fast Downloads</span>
              </div>
              <div className="feature">
                <span className="feature-icon">✨</span>
                <span className="feature-text">HD Quality</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🛡️</span>
                <span className="feature-text">Secure & Private</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🛰️</span>
                <span className="feature-text">All Platforms</span>
              </div>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}
