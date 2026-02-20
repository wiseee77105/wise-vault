const PLATFORM_PATTERNS = {
    instagram: [
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel|reels|stories|tv)\//i,
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/share\//i,
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[\w.]+\/?$/i,
        /(?:https?:\/\/)?(?:www\.)?instagr\.am\//i,
    ],
    tiktok: [
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/photo\/\d+/i,
        /(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\//i,
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\//i,
    ],
    youtube: [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\//i,
        /(?:https?:\/\/)?youtu\.be\//i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\//i,
        /(?:https?:\/\/)?music\.youtube\.com\/watch\?/i,
    ],
    facebook: [
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[\w.]+\/videos\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:watch|reel|share)\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[\w.]+\/posts\//i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/photo/i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/permalink\.php/i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/story\.php/i,
        /(?:https?:\/\/)?(?:www\.)?facebook\.com\/\d+\/(?:posts|videos)\//i,
        /(?:https?:\/\/)?fb\.watch\//i,
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

export function detectPlatform(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(trimmed)) return platform;
        }
    }
    return null;
}

export function getPlatformInfo(platform) {
    const info = {
        instagram: {
            name: 'Instagram',
            color: '#E4405F',
            gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            formats: ['MP4', 'PNG'],
        },
        tiktok: {
            name: 'TikTok',
            color: '#00f2ea',
            gradient: 'linear-gradient(45deg, #00f2ea, #ff0050)',
            formats: ['MP4', 'JPG'],
        },
        youtube: {
            name: 'YouTube',
            color: '#FF0000',
            gradient: 'linear-gradient(45deg, #FF0000, #cc0000)',
            formats: ['MP4'],
            qualities: ['1080p 60fps', '720p', '480p'],
        },
        facebook: {
            name: 'Facebook',
            color: '#1877F2',
            gradient: 'linear-gradient(45deg, #1877F2, #42a5f5)',
            formats: ['MP4', 'PNG'],
        },
        twitter: {
            name: 'Twitter/X',
            color: '#1D9BF0',
            gradient: 'linear-gradient(45deg, #000000, #1D9BF0)',
            formats: ['MP4', 'PNG'],
        },
    };
    return info[platform] || null;
}

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter'];
