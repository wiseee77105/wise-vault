import { FaTriangleExclamation, FaArrowRotateLeft, FaCircleInfo } from 'react-icons/fa6';
import './ErrorMessage.css';

const ERROR_INFO = {
    INVALID_URL: {
        title: 'Invalid URL',
        desc: 'The link you entered doesn\'t appear to be valid.',
        tip: 'Make sure to paste the full URL including https://',
    },
    UNSUPPORTED: {
        title: 'Unsupported Platform',
        desc: 'This URL is not from a supported platform.',
        tip: 'We support Instagram, TikTok, YouTube, Facebook, and Twitter/X.',
    },
    PRIVATE_CONTENT: {
        title: 'Private Content',
        desc: 'This content is private and cannot be downloaded.',
        tip: 'Only public posts and videos can be downloaded.',
    },
    NETWORK_ERROR: {
        title: 'Connection Error',
        desc: 'Could not connect to the server.',
        tip: 'Please check your internet connection and try again.',
    },
    RATE_LIMITED: {
        title: 'Too Many Requests',
        desc: 'You\'ve made too many requests in a short time.',
        tip: 'Please wait a moment and try again.',
    },
    PROCESSING_ERROR: {
        title: 'Processing Failed',
        desc: 'Could not process this content.',
        tip: 'The content may be unavailable or in an unsupported format.',
    },
    API_ERROR: {
        title: 'Service Unavailable',
        desc: 'Download service is temporarily unavailable.',
        tip: 'Please try again in a few moments. If the issue persists, the content may be private or restricted.',
    },
};

export default function ErrorMessage({ error, onRetry, onReset }) {
    const code = error?.code || 'PROCESSING_ERROR';
    const info = ERROR_INFO[code] || ERROR_INFO.PROCESSING_ERROR;

    return (
        <div className="error-container">
            <div className="error-icon">
                <FaTriangleExclamation />
            </div>
            <h3 className="error-title">{info.title}</h3>
            <p className="error-desc">{error?.message || info.desc}</p>
            <div className="error-tip">
                <FaCircleInfo />
                <span>{info.tip}</span>
            </div>
            <div className="error-actions">
                <button className="error-retry-btn" onClick={onRetry}>
                    <FaArrowRotateLeft /> Try Again
                </button>
                <button className="error-reset-btn" onClick={onReset}>
                    Start Over
                </button>
            </div>
        </div>
    );
}
