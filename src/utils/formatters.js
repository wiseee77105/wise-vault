export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown size';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
}

export function formatResolution(quality) {
    if (!quality) return '';
    const map = {
        'Original': 'Original Quality',
        'original': 'Original Quality',
        'HD 1080p 60fps': '✨ HD 1080p 60fps',
        'HD 1080p': '✨ HD 1080p',
        'HD': '✨ HD Quality',
        'max': '✨ Best HD Quality',
        'hd': '✨ High Quality',
        'SD': 'Standard Quality',
        'Standard': 'Standard Quality',
        'standard': 'Standard Quality',
    };
    return map[quality] || quality;
}

export function formatDuration(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getQualityLabel(quality) {
    const labels = {
        original: { label: 'Original', desc: 'Original resolution, no processing', icon: '' },
        max: { label: 'HD 1080p 60fps', desc: 'Upscaled via FFmpeg processing', icon: '✨' },
        hd: { label: 'HD 1080p', desc: 'HD resolution', icon: '✨' },
        standard: { label: 'Standard', desc: 'Original quality, faster download', icon: '' },
    };
    return labels[quality] || labels.max;
}
