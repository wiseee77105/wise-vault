import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createWriteStream, unlinkSync, mkdtempSync, existsSync } from 'fs';
import { tmpdir, platform } from 'os';
import { execFile } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import fs from 'fs';

// ── btch-downloader: all-in-one social media downloader ─────────────────────
import { igdl, ttdl, youtube as ytdl, twitter as twitterDl, fbdown } from 'btch-downloader';

// ── ffmpeg-static: bundled ffmpeg binary ────────────────────────────────────
import ffmpegStatic from 'ffmpeg-static';

const app = express();
const PORT = process.env.PORT || 3001;

// ── FFmpeg path: use system binary in production (Linux), static binary in dev (Windows)
const ffmpegExec = platform() === 'win32' ? ffmpegStatic : 'ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure required directories exist
['temp_downloads', 'temp_hd'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log(`[WiseVault] FFmpeg path: ${ffmpegExec}`);

app.use(cors());
app.use(express.json());

// ─── Rate Limiting ──────────────────────────────────────────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 15;

function rateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { start: now, count: 1 });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT_MAX;
}

// ─── Platform Detection ─────────────────────────────────────────────────────

const PLATFORM_PATTERNS = {
    youtube: [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[\w-]+/i,
        /(?:https?:\/\/)?youtu\.be\/[\w-]+/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/[\w-]+/i,
        /(?:https?:\/\/)?music\.youtube\.com\/watch\?v=[\w-]+/i,
    ],
    tiktok: [
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/photo\/\d+/i,
        /(?:https?:\/\/)?vm\.tiktok\.com\/[\w-]+/i,
        /(?:https?:\/\/)?vt\.tiktok\.com\/[\w-]+/i,
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/[\w-]+/i,
    ],
    instagram: [
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/[\w-]+/i,
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/stories\/[\w.-]+\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/share\//i,
    ],
    facebook: [
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.*\/videos?\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/watch\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/reel\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/share\//i,
        /(?:https?:\/\/)?fb\.watch\/[\w-]+/i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/photo/i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[\w.]+\/posts\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/permalink\.php/i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/story\.php/i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/\d+\/(?:posts|videos)\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:groups|events)\/[^/]+\/(?:posts|permalink)\//i,
    ],
    twitter: [
        /(?:https?:\/\/)?(?:www\.)?twitter\.com\/\w+\/status\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?x\.com\/\w+\/status\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?fixupx\.com\/\w+\/status\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?vxtwitter\.com\/\w+\/status\/\d+/i,
        /(?:https?:\/\/)?t\.co\/\w+/i,
    ],
};

function detectPlatform(url) {
    for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
        if (patterns.some(p => p.test(url))) return platform;
    }
    return null;
}

/**
 * Normalize Twitter/X URLs — convert fixupx.com, vxtwitter.com to x.com
 */
function normalizeTwitterUrl(url) {
    return url
        .replace(/(?:www\.)?fixupx\.com/i, 'x.com')
        .replace(/(?:www\.)?vxtwitter\.com/i, 'x.com')
        .replace(/(?:www\.)?twitter\.com/i, 'x.com');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

function safeFilename(title, platform, ext = 'mp4') {
    const base = (title || `${platform}_download`)
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 80);
    return `${base}.${ext}`;
}

/**
 * Extract the original URL from a JWT-token-based CDN URL
 * (used by rapidcdn.app, snapcdn.app, etc.)
 */
function extractUrlFromJwt(tokenUrl) {
    try {
        if (!tokenUrl || typeof tokenUrl !== 'string') return null;
        let token = null;

        // URL with ?token= parameter
        if (tokenUrl.includes('token=')) {
            const u = new URL(tokenUrl);
            token = u.searchParams.get('token');
        }

        if (!token) return null;
        const parts = token.split('.');
        if (parts.length < 2) return null;

        // Decode the payload (base64url)
        let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (payload.length % 4) payload += '=';
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        const obj = JSON.parse(decoded);
        return obj.url || obj.src || obj.link || null;
    } catch {
        return null;
    }
}

/**
 * Extract a unique image identifier from a CDN URL
 * e.g. Instagram: ".../HASH_n.jpg?..." → the HASH part
 */
function getImageIdFromUrl(cdnUrl) {
    if (!cdnUrl) return null;
    // Instagram: .../624711695_18121977382576037_4857857168522487127_n.jpg?...
    const match = cdnUrl.match(/\/([0-9]+_[0-9]+_[0-9]+)_n\./);
    if (match) return match[1];
    // Generic: use last path segment before query
    const pathMatch = cdnUrl.match(/\/([^/?]+?)(?:\?|$)/);
    return pathMatch ? pathMatch[1] : cdnUrl;
}

/**
 * Detect media type from URL (photo vs video)
 */
function detectMediaType(url) {
    if (!url || typeof url !== 'string') return 'unknown';
    const lower = url.toLowerCase();

    // Direct extension
    if (lower.match(/\.(jpg|jpeg|png|webp|gif|heic|avif)(\?|$)/)) return 'photo';
    if (lower.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/)) return 'video';

    // Token-based CDN URLs — decode JWT to check inner URL
    if (lower.includes('token=ey')) {
        const innerUrl = extractUrlFromJwt(url);
        if (innerUrl) {
            const il = innerUrl.toLowerCase();
            // Instagram CDN: t51.xxxx = photo, t50.xxxx = video
            // IMPORTANT: /v/ is part of ALL Instagram CDN URLs, NOT a video indicator
            if (il.includes('/t50.')) return 'video';
            if (il.includes('/t51.')) return 'photo';
            if (il.includes('video_dashinit') || il.includes('bytestart')) return 'video';
            if (il.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/)) return 'photo';
            if (il.match(/\.(mp4|webm|mov)(\?|$)/)) return 'video';
            if (il.includes('_n.jpg') || il.includes('_n.png') || il.includes('_n.webp')) return 'photo';
        }
    }

    // twimg.com
    if (lower.includes('pbs.twimg.com/media/')) return 'photo';
    if (lower.includes('video.twimg.com/')) return 'video';
    // Instagram CDN direct (no token)
    if (lower.includes('cdninstagram.com') && lower.includes('/t51.')) return 'photo';
    if (lower.includes('cdninstagram.com') && lower.includes('/t50.')) return 'video';

    return 'unknown';
}

/**
 * HEAD request to check content type
 */
async function headCheckMediaType(url) {
    try {
        const res = await fetch(url, {
            method: 'HEAD', headers: COMMON_HEADERS,
            redirect: 'follow', signal: AbortSignal.timeout(5000),
        });
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('image')) return 'photo';
        if (ct.includes('video')) return 'video';
    } catch { /* ignore */ }
    return null;
}

/**
 * Try to resolve a download service URL (e.g. savenow.to) to a direct media URL.
 * Follows redirects and parses HTML for embedded video links.
 */
async function resolveDownloadUrl(url, depth = 0) {
    if (depth > 3) return { url, resolved: false };
    try {
        const res = await fetch(url, {
            headers: COMMON_HEADERS,
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
        });

        const ct = (res.headers.get('content-type') || '').toLowerCase();

        // Direct media
        if (ct.includes('video') || ct.includes('audio') || ct.includes('octet-stream')) {
            return { url: res.url, resolved: true };
        }

        // HTML → try to extract direct links
        if (ct.includes('text/html')) {
            const html = await res.text();

            // Meta refresh
            const metaRefresh = html.match(/content="\d+;\s*url='?([^"'>\s]+)/i);
            if (metaRefresh) {
                return resolveDownloadUrl(metaRefresh[1], depth + 1);
            }

            // JS location redirect
            const jsLoc = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)/i);
            if (jsLoc && jsLoc[1].startsWith('http')) {
                return resolveDownloadUrl(jsLoc[1], depth + 1);
            }

            // Direct video link
            const videoHref = html.match(/href=["'](https?:\/\/[^"']*?\.(?:mp4|webm|mkv)[^"']*?)["']/i);
            if (videoHref) return { url: videoHref[1], resolved: true };

            const videoSrc = html.match(/<source[^>]+src=["'](https?:\/\/[^"']+)["']/i);
            if (videoSrc) return { url: videoSrc[1], resolved: true };
        }

        return { url, resolved: false };
    } catch {
        return { url, resolved: false };
    }
}


// ═══════════════════════════════════════════════════════════════════════════
//  HD MODE — FFmpeg upscale to 1080p 60fps
//
//  Optimized for speed:
//  - Direct URL input (no download step)
//  - ultrafast preset (fastest encoding)
//  - Multi-threaded (-threads 0)
//  - Typical delay: ~5-15 seconds
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process a video URL through ffmpeg to upscale to 1080p 60fps.
 * Returns the path to the processed temp file.
 */
async function processVideoHD(inputUrl) {
    const tempDir = mkdtempSync(join(tmpdir(), 'wisevault-'));
    const outputPath = join(tempDir, `hd_${Date.now()}.mp4`);

    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-i', inputUrl,
            '-vf', 'scale=-2:1080',
            '-r', '60',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-threads', '0',
            '-movflags', '+faststart',
            outputPath,
        ];

        console.log(`[WiseVault] FFmpeg HD processing: ${inputUrl.substring(0, 80)}...`);
        const startTime = Date.now();

        const proc = execFile(ffmpegExec, args, {
            timeout: 120000, // 2 minute max
            maxBuffer: 10 * 1024 * 1024,
        }, (error) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            if (error) {
                console.error(`[WiseVault] FFmpeg error after ${elapsed}s:`, error.message);
                // Clean up on error
                try { unlinkSync(outputPath); } catch { /* ignore */ }
                reject(new Error('HD processing failed'));
            } else {
                console.log(`[WiseVault] FFmpeg HD done in ${elapsed}s → ${outputPath}`);
                resolve(outputPath);
            }
        });

        // Log progress
        if (proc.stderr) {
            proc.stderr.on('data', (data) => {
                const line = data.toString().trim();
                if (line.includes('frame=') || line.includes('time=')) {
                    // Only log progress lines
                    console.log(`[WiseVault] FFmpeg: ${line.substring(0, 100)}`);
                }
            });
        }
    });
}

/**
 * Clean up a temp file after it has been served
 */
function cleanupTempFile(filePath) {
    setTimeout(() => {
        try {
            if (existsSync(filePath)) {
                unlinkSync(filePath);
                // Try to remove parent temp dir too
                const dir = dirname(filePath);
                if (dir.includes('wisevault-')) {
                    try { unlinkSync(dir); } catch { /* dir might not be empty */ }
                }
            }
        } catch { /* ignore */ }
    }, 5000);
}


// ═══════════════════════════════════════════════════════════════════════════
//  INSTAGRAM
//
//  igdl() returns: { result: [{ thumbnail, url }, ...] }
//  Problem: returns ~3x duplicates (different resolutions per image)
//  Solution: deduplicate by decoding JWT tokens to get original CDN URLs
//            and comparing image IDs
// ═══════════════════════════════════════════════════════════════════════════

async function instagramBtch(url, isHD) {
    console.log('[WiseVault] igdl() calling...');
    const data = await igdl(url);
    console.log('[WiseVault] igdl() raw count:', data?.result?.length || 0);

    if (!data?.status && !data?.result) throw new Error('Instagram API error');

    const mediaList = data.result || data.data || (Array.isArray(data) ? data : [data]);
    if (!Array.isArray(mediaList) || mediaList.length === 0) throw new Error('No Instagram media');

    // Build items with deduplication
    const seen = new Set();
    const items = [];

    for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        const dlUrl = item.url || item.download || item.downloadUrl || '';
        const thumb = item.thumbnail || item.thumb || '';
        if (!dlUrl) continue;

        // Deduplicate: extract the original CDN URL from the JWT token
        // and use the image ID as a unique key
        const originalUrl = extractUrlFromJwt(dlUrl) || dlUrl;
        const imageId = getImageIdFromUrl(originalUrl);
        const dedupeKey = imageId || originalUrl;

        if (seen.has(dedupeKey)) {
            console.log(`[WiseVault] IG dedup: skipping duplicate #${i + 1} (${dedupeKey.substring(0, 40)})`);
            continue;
        }
        seen.add(dedupeKey);

        // Detect media type — improved for Instagram
        // The decoded original URL from JWT token is the most reliable source
        let mType = detectMediaType(dlUrl);

        // For Instagram: use CDN type markers from original URL
        // Instagram CDN: /t50.xxxx/ = video, /t51.xxxx/ = photo
        // IMPORTANT: /v/ appears in ALL Instagram CDN URLs and is NOT a video indicator
        if (originalUrl) {
            const origLower = originalUrl.toLowerCase();
            if (origLower.includes('/t50.') || origLower.includes('video_dashinit') || origLower.includes('bytestart')) {
                mType = 'video';
            } else if (origLower.includes('/t51.') || origLower.match(/_n\.(jpg|jpeg|png|webp)/)) {
                mType = 'photo';
            }
        }

        // HEAD-check as fallback when URL patterns are ambiguous
        if (mType === 'unknown') {
            const headType = await headCheckMediaType(dlUrl);
            if (headType) mType = headType;
            else mType = 'video'; // final fallback
        }

        const ext = mType === 'photo' ? 'jpg' : 'mp4';
        items.push({
            downloadUrl: dlUrl,
            thumb: thumb || (mType === 'photo' ? dlUrl : ''),
            format: ext,
            filename: safeFilename(`instagram_${items.length + 1}`, 'instagram', ext),
            quality: isHD ? 'HD 1080p 60fps' : 'Original',
            mediaType: mType,
        });
    }

    console.log(`[WiseVault] IG final: ${items.length} unique items (from ${mediaList.length} raw)`);

    if (items.length === 0) throw new Error('No download links found');
    if (items.length === 1) return items[0];
    return { multiple: true, items };
}


// ═══════════════════════════════════════════════════════════════════════════
//  TIKTOK (TikWM primary, btch-downloader fallback)
// ═══════════════════════════════════════════════════════════════════════════

async function tiktokTikWM(url, isHD) {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${isHD ? 1 : 0}`;
    const res = await fetch(apiUrl, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('TikWM returned ' + res.status);

    const json = await res.json();
    if (json.code !== 0 && json.code !== undefined) throw new Error(json.msg || 'TikWM error');
    const data = json.data;
    if (!data) throw new Error('No data from TikWM');

    // Photo / Slideshow
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        const items = data.images.map((img, i) => {
            const imgUrl = typeof img === 'string' ? img : (img.url || img.src || '');
            const fullUrl = imgUrl.startsWith('http') ? imgUrl : `https://www.tikwm.com${imgUrl}`;
            return {
                downloadUrl: fullUrl, thumb: fullUrl, format: 'jpg',
                filename: safeFilename(`tiktok_photo_${i + 1}`, 'tiktok', 'jpg'),
                quality: 'Original',
                mediaType: 'photo',
            };
        });
        return { multiple: true, items };
    }

    // Also check image_post_info (newer TikWM format)
    if (data.image_post_info && data.image_post_info.images) {
        const imgs = data.image_post_info.images;
        const items = imgs.map((img, i) => {
            const imgUrl = img.display_image?.url_list?.[0] || img.url || '';
            return {
                downloadUrl: imgUrl, thumb: imgUrl, format: 'jpg',
                filename: safeFilename(`tiktok_photo_${i + 1}`, 'tiktok', 'jpg'),
                quality: 'Original',
                mediaType: 'photo',
            };
        }).filter(i => i.downloadUrl);
        if (items.length > 0) return { multiple: true, items };
    }

    const resultItems = [];

    // 1. Video
    const downloadUrl = isHD ? (data.hdplay || data.play) : data.play;
    if (downloadUrl) {
        const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `https://www.tikwm.com${downloadUrl}`;
        resultItems.push({
            downloadUrl: fullUrl,
            thumb: data.cover || data.origin_cover || '',
            format: 'mp4',
            filename: safeFilename(data.title || 'tiktok_video', 'tiktok'),
            quality: isHD ? 'HD 1080p 60fps' : 'Original',
            title: data.title || '',
            mediaType: 'video',
        });
    }

    // 2. Audio/Music
    if (data.music) {
        resultItems.push({
            downloadUrl: data.music.startsWith('http') ? data.music : `https://www.tikwm.com${data.music}`,
            thumb: data.music_info?.cover || data.cover || '',
            format: 'mp3',
            filename: safeFilename(data.music_info?.title || data.title || 'tiktok_audio', 'tiktok', 'mp3'),
            quality: 'Original Audio',
            title: data.music_info?.title || data.title || '',
            mediaType: 'audio',
        });
    }

    if (resultItems.length === 0) throw new Error('No download link');
    if (resultItems.length === 1) return resultItems[0];
    return { multiple: true, items: resultItems };
}

async function tiktokBtch(url, isHD) {
    const data = await ttdl(url);
    const result = data?.result || data?.data || data;

    // Check multiple image source fields
    const images = result?.images || result?.image || result?.photos
        || result?.imagePost || result?.slides;
    if (images && Array.isArray(images) && images.length > 0) {
        const items = images.map((img, i) => {
            const imgUrl = typeof img === 'string' ? img : (img.url || img.src || '');
            return {
                downloadUrl: imgUrl, thumb: imgUrl, format: 'jpg',
                filename: safeFilename(`tiktok_photo_${i + 1}`, 'tiktok', 'jpg'),
                quality: 'Original',
                mediaType: 'photo',
            };
        }).filter(i => i.downloadUrl);
        if (items.length > 0) return { multiple: true, items };
    }

    const videoUrl = result?.video || result?.play || result?.hdplay || result?.nowm
        || result?.no_wm || result?.download || result?.mp4 || result?.url;
    const dlUrl = typeof videoUrl === 'string' ? videoUrl : (videoUrl?.url || '');
    if (!dlUrl) throw new Error('No TikTok download link');

    return {
        downloadUrl: dlUrl, thumb: result?.cover || result?.thumbnail || '',
        format: 'mp4', filename: safeFilename(result?.title || 'tiktok_video', 'tiktok'),
        quality: isHD ? 'HD 1080p 60fps' : 'Original', mediaType: 'video',
    };
}


// ═══════════════════════════════════════════════════════════════════════════
//  YOUTUBE
//
//  ytdl() returns: { title, thumbnail, author, mp3, mp4 }
//  mp4 points to savenow.to (download service redirect).
//  We try to resolve it server-side to get a direct video URL.
//  If resolution fails, we stream through proxy anyway.
// ═══════════════════════════════════════════════════════════════════════════

async function youtubeBtch(url, isHD) {
    console.log('[WiseVault] ytdl() calling...');
    const data = await ytdl(url);
    console.log('[WiseVault] ytdl() returned:', JSON.stringify(data).substring(0, 300));

    if (!data?.status) throw new Error('YouTube API error');

    const videoUrl = data.mp4 || data.video || data.url || data.download;
    if (!videoUrl) throw new Error('No YouTube download link');

    const items = [];

    // 1. Video
    items.push({
        downloadUrl: videoUrl,
        thumb: data.thumbnail || data.image || '',
        format: 'mp4',
        filename: safeFilename(data.title || 'youtube_video', 'youtube'),
        quality: isHD ? 'HD 1080p 60fps' : 'Original',
        title: data.title || '',
        author: data.author || '',
        mediaType: 'video',
    });

    // 2. Audio (if available)
    const audioUrl = data.mp3 || data.audio;
    if (audioUrl) {
        items.push({
            downloadUrl: audioUrl,
            thumb: data.thumbnail || data.image || '',
            format: 'mp3',
            filename: safeFilename(data.title || 'youtube_audio', 'youtube', 'mp3'),
            quality: 'Original Audio',
            title: data.title || '',
            author: data.author || '',
            mediaType: 'audio',
        });
    }

    if (items.length === 1) return items[0];
    return { multiple: true, items };
}


// ═══════════════════════════════════════════════════════════════════════════
//  FACEBOOK
//
//  fbdown() returns: { Normal_video, HD, ... } for videos
//  Returns { status: false } for photo posts.
//  Fallback: scrape og:image from the Facebook page.
// ═══════════════════════════════════════════════════════════════════════════

async function facebookBtch(url, isHD) {
    console.log('[WiseVault] fbdown() calling...');
    const data = await fbdown(url);
    console.log('[WiseVault] fbdown() returned:', JSON.stringify(data).substring(0, 300));

    if (!data?.status) throw new Error('Facebook API returned error');

    // Try all possible field names for video URLs
    const hdUrl = data.HD || data.HD_video || data.hd || data.hd_url || data.high;
    const sdUrl = data.Normal_video || data.SD || data.sd || data.sd_url || data.normal || data.low;

    // Also check nested result/data
    const r = data.result || data.data;
    const hdUrl2 = r?.HD || r?.HD_video || r?.hd;
    const sdUrl2 = r?.Normal_video || r?.SD || r?.sd || r?.normal;

    const finalHd = hdUrl || hdUrl2;
    const finalSd = sdUrl || sdUrl2;
    // Non-HD: always prefer SD source. HD: prefer HD source.
    let dlUrl = isHD ? (finalHd || finalSd) : (finalSd || finalHd);

    // Last resort: scan all string values for URLs
    if (!dlUrl) {
        const allUrls = Object.values(data)
            .filter(v => typeof v === 'string' && v.startsWith('http'))
            .filter(v => v.includes('video') || v.includes('download') || v.includes('fbcdn') || v.includes('snapcdn'));
        if (allUrls.length > 0) dlUrl = allUrls[0];
    }

    if (!dlUrl) throw new Error('No Facebook download link');

    // Get thumbnail — try multiple sources to always show preview
    let thumb = data.thumbnail || data.thumb || data.image || '';
    if (!thumb) {
        // Try to get og:image from the Facebook page as thumbnail
        try {
            const pageRes = await fetch(url, {
                headers: { ...COMMON_HEADERS, 'Accept': 'text/html' },
                redirect: 'follow',
                signal: AbortSignal.timeout(5000),
            });
            if (pageRes.ok) {
                const html = await pageRes.text();
                const ogMatch = html.match(/property=["']og:image["']\s*content=["']([^"']+)["']/i);
                if (ogMatch) thumb = ogMatch[1];
            }
        } catch { /* ignore */ }
    }

    const mType = detectMediaType(dlUrl);
    const ext = mType === 'photo' ? 'jpg' : 'mp4';

    return {
        downloadUrl: dlUrl,
        thumb,
        format: ext,
        filename: safeFilename(data.title || 'facebook_media', 'facebook', ext),
        quality: isHD ? 'HD 1080p 60fps' : 'Original',
        title: data.title || '',
        mediaType: mType,
    };
}

/**
 * Facebook photo fallback — only detect post photos (og:image), NOT comment photos
 * og:image meta tags represent the primary post media, not user comments
 */
async function facebookPhotoFallback(url, isHD) {
    console.log('[WiseVault] Facebook photo fallback: scraping og:image only...');
    const res = await fetch(url, {
        headers: { ...COMMON_HEADERS, 'Accept': 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('Facebook page returned ' + res.status);
    const html = await res.text();

    // ONLY extract og:image meta tags — these are the post's primary photos
    // Do NOT scrape scontent URLs or other embedded images (those include comment photos)
    const ogImages = [...html.matchAll(/property=["']og:image["']\s*content=["']([^"']+)["']/gi)];
    const images = ogImages.map(m => m[1]).filter(u => u.startsWith('http'));

    // Deduplicate (sometimes same og:image appears multiple times)
    const uniqueImages = [...new Set(images)];

    if (uniqueImages.length === 0) throw new Error('No Facebook post images found');

    if (uniqueImages.length === 1) {
        return {
            downloadUrl: uniqueImages[0], thumb: uniqueImages[0],
            format: 'jpg', filename: safeFilename('facebook_photo', 'facebook', 'jpg'),
            quality: 'Original', mediaType: 'photo',
        };
    }

    return {
        multiple: true,
        items: uniqueImages.map((img, i) => ({
            downloadUrl: img, thumb: img, format: 'jpg',
            filename: safeFilename(`facebook_photo_${i + 1}`, 'facebook', 'jpg'),
            quality: 'Original',
            mediaType: 'photo',
        })),
    };
}


// ═══════════════════════════════════════════════════════════════════════════
//  TWITTER/X
//
//  twitterDl() returns:
//    Videos: { title, url: [{hd: "..."}, {sd: "..."}] }
//    Photos: { title, url: [{}, {}] }  ← empty objects! API can't extract photos
//
//  For photos, we fallback to fxtwitter API which supports photos natively:
//    GET https://api.fxtwitter.com/USERNAME/status/TWEET_ID
//    Response: { tweet: { media: { photos: [{url, ...}], videos: [...] } } }
// ═══════════════════════════════════════════════════════════════════════════

async function twitterBtch(url, isHD) {
    // Normalize URL for the API
    const normalizedUrl = normalizeTwitterUrl(url);
    console.log('[WiseVault] twitterDl() calling with:', normalizedUrl);
    const data = await twitterDl(normalizedUrl);
    console.log('[WiseVault] twitterDl() returned:', JSON.stringify(data).substring(0, 300));

    if (!data?.status) throw new Error('Twitter API error');

    const rawUrl = data.url || data.download;
    if (!rawUrl) throw new Error('No Twitter media');

    // Case 1: string URL (single item)
    if (typeof rawUrl === 'string') {
        const mType = detectMediaType(rawUrl);
        const ext = mType === 'photo' ? 'jpg' : 'mp4';
        return {
            downloadUrl: rawUrl, thumb: mType === 'photo' ? rawUrl : '',
            format: ext, filename: safeFilename('twitter_media', 'twitter', ext),
            quality: isHD ? 'HD 1080p 60fps' : 'Original', mediaType: mType,
        };
    }

    // Case 2: array of {hd, sd} objects (video with quality options)
    if (Array.isArray(rawUrl)) {
        let hdUrl = null, sdUrl = null;
        let hasAnyUrl = false;

        for (const item of rawUrl) {
            if (item && typeof item === 'object') {
                if (item.hd) { hdUrl = item.hd; hasAnyUrl = true; }
                if (item.sd) { sdUrl = item.sd; hasAnyUrl = true; }
                if (item.url) { hasAnyUrl = true; if (!hdUrl) hdUrl = item.url; else if (!sdUrl) sdUrl = item.url; }
            } else if (typeof item === 'string') {
                hasAnyUrl = true;
                if (!hdUrl) hdUrl = item; else if (!sdUrl) sdUrl = item;
            }
        }

        // If all objects are empty → photo tweet → delegate to fxtwitter
        if (!hasAnyUrl) {
            throw new Error('PHOTO_TWEET'); // Will be caught and fallback to fxtwitter
        }

        // Non-HD: always prefer SD source. HD: prefer HD source.
        const dlUrl = isHD ? (hdUrl || sdUrl) : (sdUrl || hdUrl);
        if (!dlUrl) throw new Error('No Twitter video link');

        // Try to get thumbnail from fxtwitter for preview
        let thumb = '';
        try {
            const tweetMatch = normalizedUrl.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i);
            if (tweetMatch) {
                const fxRes = await fetch(`https://api.fxtwitter.com/${tweetMatch[1]}/status/${tweetMatch[2]}`, {
                    headers: { ...COMMON_HEADERS, 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000),
                });
                if (fxRes.ok) {
                    const fxData = await fxRes.json();
                    thumb = fxData.tweet?.media?.videos?.[0]?.thumbnail_url
                        || fxData.tweet?.media?.photos?.[0]?.url
                        || '';
                }
            }
        } catch { /* ignore — preview is optional */ }

        return {
            downloadUrl: dlUrl, thumb,
            format: 'mp4', filename: safeFilename('twitter_video', 'twitter'),
            quality: isHD ? 'HD 1080p 60fps' : 'Original', title: data.title || '',
            mediaType: 'video',
        };
    }

    throw new Error('Unrecognized Twitter format');
}

/**
 * Twitter/X fallback using fxtwitter API
 * Works for BOTH photos and videos
 */
async function twitterFxFallback(url, isHD) {
    // Normalize URL first
    const normalizedUrl = normalizeTwitterUrl(url);

    // Extract tweet info from URL
    const tweetMatch = normalizedUrl.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i);
    if (!tweetMatch) throw new Error('Invalid Twitter URL');

    const apiUrl = `https://api.fxtwitter.com/${tweetMatch[1]}/status/${tweetMatch[2]}`;
    console.log('[WiseVault] fxtwitter API:', apiUrl);

    const res = await fetch(apiUrl, {
        headers: { ...COMMON_HEADERS, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error('fxtwitter returned ' + res.status);
    const data = await res.json();

    const tweet = data.tweet;
    if (!tweet) throw new Error('No tweet data from fxtwitter');

    const media = tweet.media;
    if (!media) throw new Error('No media in tweet');

    const items = [];

    // Photos: { type: "photo", url, width, height }
    if (media.photos && Array.isArray(media.photos)) {
        for (const photo of media.photos) {
            items.push({
                downloadUrl: photo.url,
                thumb: photo.url,
                format: 'jpg',
                filename: safeFilename(`twitter_photo_${items.length + 1}`, 'twitter', 'jpg'),
                quality: 'Original',
                mediaType: 'photo',
            });
        }
    }

    // Videos
    if (media.videos && Array.isArray(media.videos)) {
        for (const video of media.videos) {
            const dlUrl = video.url || '';
            if (dlUrl) {
                items.push({
                    downloadUrl: dlUrl,
                    thumb: video.thumbnail_url || tweet.media?.photos?.[0]?.url || '',
                    format: 'mp4',
                    filename: safeFilename(`twitter_video_${items.length + 1}`, 'twitter'),
                    quality: isHD ? 'HD 1080p 60fps' : 'Original',
                    mediaType: 'video',
                });
            }
        }
    }

    // Also check media.all for any other items
    if (items.length === 0 && media.all && Array.isArray(media.all)) {
        for (const m of media.all) {
            const mType = m.type === 'photo' ? 'photo' : 'video';
            const ext = mType === 'photo' ? 'jpg' : 'mp4';
            items.push({
                downloadUrl: m.url, thumb: mType === 'photo' ? m.url : (m.thumbnail_url || ''),
                format: ext, filename: safeFilename(`twitter_${mType}_${items.length + 1}`, 'twitter', ext),
                quality: mType === 'photo' ? 'Original' : (isHD ? 'HD 1080p 60fps' : 'Original'),
                mediaType: mType,
            });
        }
    }

    if (items.length === 0) throw new Error('No media found in tweet');
    if (items.length === 1) return items[0];
    return { multiple: true, items };
}

/**
 * Twitter last-resort fallback via twitsave.com HTML scraping
 */
async function twitterTwitSave(url, isHD) {
    const normalizedUrl = normalizeTwitterUrl(url);
    const apiUrl = `https://twitsave.com/info?url=${encodeURIComponent(normalizedUrl)}`;
    const res = await fetch(apiUrl, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('TwitSave returned ' + res.status);
    const html = await res.text();

    const videoMatches = [...html.matchAll(/href="(https?:\/\/[^"]*video\.twimg\.com[^"]*\.mp4[^"]*)"/gi)];
    if (videoMatches.length > 0) {
        const links = [...new Set(videoMatches.map(m => m[1]))];
        return {
            downloadUrl: isHD ? links[0] : links[links.length - 1],
            thumb: '', format: 'mp4', filename: safeFilename('twitter_video', 'twitter'),
            quality: isHD ? 'HD 1080p 60fps' : 'Original', mediaType: 'video',
        };
    }

    const imgMatches = [...html.matchAll(/src="(https?:\/\/pbs\.twimg\.com\/media\/[^"]+)"/gi)];
    const uniqueImages = [...new Set(imgMatches.map(m => m[1]))];
    if (uniqueImages.length === 0) throw new Error('No media in tweet');

    if (uniqueImages.length === 1) {
        return {
            downloadUrl: uniqueImages[0], thumb: uniqueImages[0], format: 'jpg',
            filename: safeFilename('twitter_image', 'twitter', 'jpg'),
            quality: 'Original', mediaType: 'photo',
        };
    }

    return {
        multiple: true, items: uniqueImages.map((img, i) => ({
            downloadUrl: img, thumb: img, format: 'jpg',
            filename: safeFilename(`twitter_photo_${i + 1}`, 'twitter', 'jpg'),
            quality: 'Original', mediaType: 'photo',
        }))
    };
}


// ═══════════════════════════════════════════════════════════════════════════
//  Platform Handler Map
//
//  Each platform has a chain of handlers tried in order.
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_HANDLERS = {
    youtube: {
        chain: [youtubeBtch],
    },
    tiktok: {
        chain: [tiktokTikWM, tiktokBtch],
    },
    instagram: {
        chain: [instagramBtch],
    },
    facebook: {
        chain: [facebookBtch, facebookPhotoFallback],
    },
    twitter: {
        chain: [twitterBtch, twitterFxFallback, twitterTwitSave],
    },
};


// ─── API: Download Endpoint ─────────────────────────────────────────────────

app.post('/api/download', async (req, res) => {
    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
    if (rateLimit(clientIP)) {
        return res.status(429).json({ status: 'error', message: 'Too many requests.', code: 'RATE_LIMITED' });
    }

    const { url, quality = 'max' } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ status: 'error', message: 'URL is required', code: 'INVALID_URL' });
    }

    const trimmedUrl = url.trim();
    const platform = detectPlatform(trimmedUrl);

    if (!platform) {
        return res.status(400).json({
            status: 'error',
            message: 'Unsupported URL. Supported: Instagram, TikTok, YouTube, Facebook, Twitter/X.',
            code: 'UNSUPPORTED',
        });
    }

    const handler = PLATFORM_HANDLERS[platform];
    const isHD = quality === 'max' || quality === 'hd';

    // Try each handler in the chain
    let lastError;
    for (let i = 0; i < handler.chain.length; i++) {
        const fn = handler.chain[i];
        try {
            console.log(`[WiseVault] ${platform} handler #${i + 1}/${handler.chain.length}...`);
            const result = await fn(trimmedUrl, isHD);

            if (result.multiple && result.items) {
                // Tag items with HD processing info for videos
                if (isHD) {
                    result.items.forEach(item => {
                        if (item.mediaType === 'video') {
                            item.hdProcess = true;
                        }
                    });
                }
                return res.json({ status: 'success', type: 'picker', data: { items: result.items } });
            }

            // Single result — tag with HD info
            if (isHD && result.mediaType === 'video') {
                result.hdProcess = true;
            }

            return res.json({ status: 'success', type: 'single', data: result });
        } catch (err) {
            console.warn(`[WiseVault] ${platform} handler #${i + 1} failed:`, err.message);
            lastError = err;
        }
    }

    // All handlers failed
    return res.status(500).json({
        status: 'error',
        message: 'Download service temporarily unavailable. Please try again later.',
        code: 'API_ERROR',
    });
});


// ─── API: HD Processing Endpoint ────────────────────────────────────────────
// Separate endpoint for HD video processing via FFmpeg

app.get('/api/hd-process', async (req, res) => {
    const { url, filename } = req.query;
    if (!url) return res.status(400).json({ status: 'error', message: 'URL is required' });

    try {
        console.log('[WiseVault] HD process request:', url.substring(0, 80));

        // First resolve the URL if needed
        let targetUrl = url;
        if (url.includes('savenow.to') || url.includes('pacific')) {
            const resolved = await resolveDownloadUrl(url);
            if (resolved.resolved) targetUrl = resolved.url;
        }

        // Process through ffmpeg
        const hdFilePath = await processVideoHD(targetUrl);

        const safeName = ((filename || 'wisevault_hd') + '_1080p60fps')
            .replace(/[^a-zA-Z0-9._-]/g, '_') + '.mp4';

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

        // Stream the processed file
        const { createReadStream, statSync } = await import('fs');
        const stat = statSync(hdFilePath);
        res.setHeader('Content-Length', stat.size);

        const stream = createReadStream(hdFilePath);
        stream.pipe(res);

        stream.on('end', () => {
            cleanupTempFile(hdFilePath);
        });

        stream.on('error', (err) => {
            console.error('[WiseVault] Stream error:', err.message);
            cleanupTempFile(hdFilePath);
            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: 'Stream error' });
            }
        });
    } catch (err) {
        console.error('[WiseVault] HD process error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'HD processing failed. Try standard quality.' });
        }
    }
});


// ─── API: Proxy download ────────────────────────────────────────────────────

app.get('/api/proxy-download', async (req, res) => {
    const { url, filename } = req.query;
    if (!url) return res.status(400).json({ status: 'error', message: 'URL is required' });

    try {
        console.log(`[WiseVault] Proxying: ${url.substring(0, 80)}...`);

        // Direct fetch — no slow resolveDownloadUrl step
        let targetUrl = url;

        const remote = await fetch(targetUrl, {
            headers: {
                ...COMMON_HEADERS,
                'Referer': (() => { try { return new URL(targetUrl).origin; } catch { return ''; } })(),
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(60000),
        });

        if (!remote.ok) {
            console.error(`[WiseVault] Remote returned ${remote.status}`);
            return res.status(502).json({ status: 'error', message: 'Remote file unavailable' });
        }

        const contentType = (remote.headers.get('content-type') || '').toLowerCase();

        // If response is HTML (download service page like savenow.to),
        // try to extract the actual download link from the HTML instead of redirecting
        if (contentType.includes('text/html')) {
            console.log('[WiseVault] Remote returned HTML, extracting download link...');
            const html = await remote.text();

            // Look for direct download links in the HTML
            let extractedUrl = null;

            // Meta refresh redirect
            const metaRefresh = html.match(/content="\d+;\s*url='?([^"'>\s]+)/i);
            if (metaRefresh) extractedUrl = metaRefresh[1];

            // JS location redirect
            if (!extractedUrl) {
                const jsLoc = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)/i);
                if (jsLoc && jsLoc[1].startsWith('http')) extractedUrl = jsLoc[1];
            }

            // Direct video/audio link in href
            if (!extractedUrl) {
                const videoHref = html.match(/href=["'](https?:\/\/[^"']*?\.(?:mp4|webm|mkv)[^"']*?)["']/i);
                if (videoHref) extractedUrl = videoHref[1];
            }

            // Source tag
            if (!extractedUrl) {
                const videoSrc = html.match(/<source[^>]+src=["'](https?:\/\/[^"']+)["']/i);
                if (videoSrc) extractedUrl = videoSrc[1];
            }

            if (extractedUrl) {
                console.log(`[WiseVault] Extracted link: ${extractedUrl.substring(0, 80)}`);
                // Retry with the extracted URL
                const retry = await fetch(extractedUrl, {
                    headers: { ...COMMON_HEADERS },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(60000),
                });

                if (retry.ok) {
                    const retryCt = (retry.headers.get('content-type') || '').toLowerCase();
                    if (!retryCt.includes('text/html')) {
                        // Got a downloadable file!
                        let safeName = (filename || 'wisevault_download').replace(/[^a-zA-Z0-9._-]/g, '_');
                        res.setHeader('Content-Type', retryCt || 'application/octet-stream');
                        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
                        const cl = retry.headers.get('content-length');
                        if (cl) res.setHeader('Content-Length', cl);

                        const reader = retry.body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            res.write(Buffer.from(value));
                        }
                        return res.end();
                    }
                }
            }

            // Last resort: redirect to the original URL (opens download service page)
            console.warn('[WiseVault] Could not extract link, redirecting...');
            return res.redirect(url);
        }

        let safeName = (filename || 'wisevault_download').replace(/[^a-zA-Z0-9._-]/g, '_');

        // Auto-correct extension based on actual content type
        if (contentType.includes('image') && safeName.endsWith('.mp4')) {
            safeName = safeName.replace(/\.mp4$/, '.jpg');
        } else if (contentType.includes('video') && safeName.endsWith('.jpg')) {
            safeName = safeName.replace(/\.jpg$/, '.mp4');
        }

        res.setHeader('Content-Type', contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

        const contentLength = remote.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);

        // Stream
        const reader = remote.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
        res.end();
    } catch (err) {
        console.error('[WiseVault] Proxy error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Download proxy failed' });
        }
    }
});


// ─── STATIC FRONTEND SERVING ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, 'dist')));
    // SPA routing
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(join(__dirname, 'dist', 'index.html'));
        }
    });
}

app.listen(PORT, () => {
    console.log(`[WiseVault] Server listening on port ${PORT}`);
    console.log('[WiseVault] Mode:', process.env.NODE_ENV || 'development');
});
