import './QualitySelector.css';

export default function QualitySelector({ quality, onChange, disabled }) {
    const isHD = quality === 'max' || quality === 'hd';

    const toggleHD = () => {
        onChange(isHD ? '720' : 'max');
    };

    return (
        <div className="quality-selector">
            <button
                type="button"
                className={`hd-toggle-btn ${isHD ? 'active' : ''}`}
                onClick={toggleHD}
                disabled={disabled}
            >
                <div className="hd-toggle-track">
                    <div className="hd-toggle-thumb" />
                </div>
                <div className="hd-toggle-label">
                    <span className="hd-title">{isHD ? 'HD Mode' : 'Standard Mode'}</span>
                    <span className="hd-desc">
                        {isHD
                            ? '1080p 60fps — Video will be processed via FFmpeg'
                            : 'Original resolution — Faster download'
                        }
                    </span>
                </div>
            </button>
        </div>
    );
}
