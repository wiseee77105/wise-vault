import './ProgressBar.css';

export default function ProgressBar({ progress, status, fileSize }) {
    return (
        <div className="progress-container">
            <div className="progress-status">
                <div className="progress-spinner" />
                <span className="progress-text">{status || 'Processing...'}</span>
            </div>
            <div className="progress-bar-track">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                />
                <div className="progress-bar-glow" style={{ left: `${Math.min(progress, 100)}%` }} />
            </div>
            <div className="progress-info">
                <span className="progress-percent">{Math.round(progress)}%</span>
                {fileSize && <span className="progress-size">{fileSize}</span>}
            </div>
        </div>
    );
}
