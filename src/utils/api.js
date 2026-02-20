import { detectPlatform } from './platformDetector';

/**
 * API base path — proxied to Express backend (localhost:3001) by Vite config.
 * The backend calls the public download APIs server-side, avoiding CORS.
 */
const API_BASE = '/api';

/**
 * Custom error class for download-related errors.
 * Includes an error code used by ErrorMessage.jsx to show contextual UI.
 */
export class DownloadError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'DownloadError';
    }
}

/**
 * Main download function — called by App.jsx handleSubmit().
 *
 * 1. Validates the URL and detects the platform on the client side
 * 2. Sends the URL + quality to the Express backend at /api/download
 * 3. The backend calls public APIs server-side (no CORS issues)
 * 4. Returns the result in the shape DownloadResult.jsx expects:
 *    - type: 'single' → data: { downloadUrl, thumb, format, filename, quality }
 *    - type: 'picker' → data: { items: [...] }
 *
 * Error codes: INVALID_URL, UNSUPPORTED, API_ERROR, PRIVATE_CONTENT, RATE_LIMITED
 *
 * @param {string} url      – Social media URL to download from
 * @param {string} quality  – 'max' | 'hd' = HD on; '720' | 'standard' = standard
 * @returns {Promise<object>}
 */
export async function downloadMedia(url, quality = 'max') {
    // Client-side validation before hitting the server
    if (!url || typeof url !== 'string' || !url.trim()) {
        throw new DownloadError('Please enter a valid URL', 'INVALID_URL');
    }

    const trimmedUrl = url.trim();
    const platform = detectPlatform(trimmedUrl);

    if (!platform) {
        throw new DownloadError(
            'Unsupported URL. Please provide a link from Instagram, TikTok, YouTube, Facebook, or Twitter/X.',
            'UNSUPPORTED'
        );
    }

    try {
        // Send download request to the Express backend
        const response = await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: trimmedUrl, quality }),
        });

        const data = await response.json();

        // Handle error responses from the backend
        if (data.status === 'error') {
            throw new DownloadError(data.message, data.code || 'PROCESSING_ERROR');
        }

        return data;
    } catch (err) {
        // Re-throw DownloadError as-is
        if (err instanceof DownloadError) throw err;

        // Network / fetch failure
        throw new DownloadError(
            'Could not connect to the download server. Please check your connection and try again.',
            'NETWORK_ERROR'
        );
    }
}
