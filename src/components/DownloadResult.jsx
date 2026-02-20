import { FaDownload, FaArrowRotateLeft, FaCopy, FaCheck, FaImage, FaVideo, FaImages, FaMusic } from 'react-icons/fa6';
import { useState } from 'react';
import { formatResolution } from '../utils/formatters';
import './DownloadResult.css';

export default function DownloadResult({ result, onReset }) {
    const [copied, setCopied] = useState(false);
    const [downloadingAll, setDownloadingAll] = useState(false);

    if (!result) return null;

    const isSingle = result.type !== 'picker';
    const items = isSingle ? [result.data] : result.data.items;
    const hasMultipleItems = items.length > 1;

    // Count photos vs videos in multi-item results
    const isPhotoItem = (item) => {
        if (item.mediaType) return item.mediaType === 'photo';
        return item.format !== 'mp4' && item.format !== 'webm';
    };
    const photoCount = items.filter(i => i.mediaType === 'photo').length;
    const videoCount = items.filter(i => i.mediaType === 'video').length;
    const audioCount = items.filter(i => i.mediaType === 'audio').length;

    const handleCopy = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
        }
    };

    const handleDownload = (item) => {
        const { downloadUrl, filename, directUrl, hdProcess } = item;

        if (directUrl) {
            // Some URLs (e.g. YouTube via savenow.to) are download service
            // redirects that need browser execution — open directly
            window.open(downloadUrl, '_blank');
            return;
        }

        // If HD processing is requested for video, use the HD endpoint
        if (hdProcess && item.mediaType === 'video') {
            const hdUrl = `/api/hd-process?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename || 'download')}`;
            const a = document.createElement('a');
            a.href = hdUrl;
            a.download = (filename || 'download').replace(/\.mp4$/, '_1080p60fps.mp4');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        // Route through the backend proxy so the browser receives
        // Content-Disposition: attachment and downloads the file directly
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename || 'download.mp4')}`;
        const a = document.createElement('a');
        a.href = proxyUrl;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    /**
     * Download All — triggers download of every item with a small delay
     * between each to avoid browser blocking multiple simultaneous downloads.
     */
    const handleDownloadAll = async () => {
        setDownloadingAll(true);
        for (let i = 0; i < items.length; i++) {
            handleDownload(items[i]);
            // Stagger downloads by 500ms to avoid browser popup-blocking
            if (i < items.length - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
        setDownloadingAll(false);
    };

    return (
        <div className="download-result">
            <div className="result-success-icon">
                <FaCheck />
            </div>
            <h3 className="result-title">
                {isSingle
                    ? 'Ready to Download!'
                    : `${items.length} Items Ready!`
                }
            </h3>

            {isSingle && result.data.quality && (
                <p className="result-quality">{formatResolution(result.data.quality)}</p>
            )}

            {/* Summary for multi-item results */}
            {hasMultipleItems && (
                <p className="result-summary">
                    {[
                        photoCount > 0 && `${photoCount} photo${photoCount > 1 ? 's' : ''}`,
                        videoCount > 0 && `${videoCount} video${videoCount > 1 ? 's' : ''}`,
                        audioCount > 0 && `${audioCount} audio`
                    ].filter(Boolean).join(' · ')}
                </p>
            )}

            {/* Download All button for multi-item results */}
            {hasMultipleItems && (
                <button
                    className="result-download-all-btn"
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                >
                    {downloadingAll ? (
                        <>
                            <span className="download-all-spinner" />
                            Downloading...
                        </>
                    ) : (
                        <>
                            <FaImages /> Download All ({items.length})
                        </>
                    )}
                </button>
            )}

            <div className={`result-items ${hasMultipleItems ? 'grid' : ''}`}>
                {items.map((item, i) => (
                    <div key={i} className={`result-item ${isPhotoItem(item) ? 'photo-item' : ''}`}>
                        {item.thumb && (
                            <img src={item.thumb} alt={`Preview ${i + 1}`} className="result-thumb" loading="lazy" />
                        )}
                        <div className="result-item-info">
                            <span className={`result-format format-${item.mediaType || 'video'}`}>
                                {item.mediaType === 'photo' ? <FaImage /> : item.mediaType === 'audio' ? <FaMusic /> : <FaVideo />}
                                {(item.mediaType === 'audio' ? 'AUDIO' : item.mediaType === 'photo' ? 'PHOTO' : item.format?.toUpperCase())}
                            </span>
                            {hasMultipleItems && (
                                <span className="result-item-number">#{i + 1}</span>
                            )}
                            {item.quality && (
                                <span className="result-item-quality">{item.quality}</span>
                            )}
                            {item.filename && !hasMultipleItems && (
                                <span className="result-filename">{item.filename}</span>
                            )}
                        </div>
                        <div className="result-actions">
                            <button
                                className="result-download-btn"
                                onClick={() => handleDownload(item)}
                            >
                                <FaDownload /> Download
                            </button>
                            <button
                                className="result-copy-btn"
                                onClick={() => handleCopy(item.downloadUrl)}
                                title="Copy link"
                            >
                                {copied ? <FaCheck /> : <FaCopy />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button className="result-reset-btn" onClick={onReset}>
                <FaArrowRotateLeft /> Download Another
            </button>
        </div>
    );
}
