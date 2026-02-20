import { useState, useEffect, useRef } from 'react';
import { FaInstagram, FaTiktok, FaYoutube, FaFacebookF, FaXTwitter, FaLink, FaPaste } from 'react-icons/fa6';
import { detectPlatform, getPlatformInfo } from '../utils/platformDetector';
import './URLInput.css';

const platformIcons = {
    instagram: FaInstagram,
    tiktok: FaTiktok,
    youtube: FaYoutube,
    facebook: FaFacebookF,
    twitter: FaXTwitter,
};

export default function URLInput({ onSubmit, disabled }) {
    const [url, setUrl] = useState('');
    const [detectedPlatform, setDetectedPlatform] = useState(null);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (url.length > 10) {
            const platform = detectPlatform(url);
            setDetectedPlatform(platform);
        } else {
            setDetectedPlatform(null);
        }
    }, [url]);

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setUrl(text);
                const platform = detectPlatform(text);
                if (platform) {
                    setDetectedPlatform(platform);
                }
            }
        } catch {
            // Clipboard access denied
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url.trim() && !disabled) {
            onSubmit(url.trim());
        }
    };

    const PlatformIcon = detectedPlatform ? platformIcons[detectedPlatform] : FaLink;
    const platformInfo = detectedPlatform ? getPlatformInfo(detectedPlatform) : null;

    return (
        <form className="url-input-container" onSubmit={handleSubmit}>
            <div className={`url-input-wrapper ${isFocused ? 'focused' : ''} ${detectedPlatform ? 'detected' : ''}`}
                style={detectedPlatform ? { '--platform-color': platformInfo?.color } : {}}>
                <div className={`url-input-icon ${detectedPlatform ? 'platform-detected' : ''}`}
                    style={detectedPlatform ? { color: platformInfo?.color } : {}}>
                    <PlatformIcon />
                </div>
                <input
                    ref={inputRef}
                    type="url"
                    className="url-input"
                    placeholder="Paste your link here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={disabled}
                    autoComplete="off"
                    spellCheck="false"
                    id="url-input"
                />
                <button type="button" className="paste-btn" onClick={handlePaste} title="Paste from clipboard" disabled={disabled}>
                    <FaPaste />
                </button>
                <button type="submit" className="download-btn" disabled={!url.trim() || disabled}>
                    <span>Download</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
            {detectedPlatform && (
                <div className="platform-badge" style={{ background: platformInfo?.gradient }}>
                    <PlatformIcon size={12} /> {platformInfo?.name} detected
                </div>
            )}
        </form>
    );
}
