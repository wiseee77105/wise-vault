import { FaInstagram, FaTiktok, FaYoutube, FaFacebookF, FaXTwitter } from 'react-icons/fa6';
import './PlatformCards.css';

const platforms = [
    { id: 'instagram', name: 'Instagram', icon: FaInstagram, gradient: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' },
    { id: 'tiktok', name: 'TikTok', icon: FaTiktok, gradient: 'linear-gradient(135deg, #00f2ea, #ff0050)' },
    { id: 'youtube', name: 'YouTube', icon: FaYoutube, gradient: 'linear-gradient(135deg, #FF0000, #cc0000)' },
    { id: 'facebook', name: 'Facebook', icon: FaFacebookF, gradient: 'linear-gradient(135deg, #1877F2, #42a5f5)' },
    { id: 'twitter', name: 'Twitter/X', icon: FaXTwitter, gradient: 'linear-gradient(135deg, #000000, #1D9BF0)' },
];

export default function PlatformCards() {
    return (
        <div className="platform-cards">
            <p className="platform-cards-label">Supported Platforms</p>
            <div className="platform-cards-grid">
                {platforms.map((p, i) => {
                    const Icon = p.icon;
                    return (
                        <div key={p.id} className="platform-card" style={{ '--delay': `${i * 0.08}s`, '--platform-gradient': p.gradient }}>
                            <div className="platform-card-icon">
                                <Icon />
                            </div>
                            <span className="platform-card-name">{p.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
