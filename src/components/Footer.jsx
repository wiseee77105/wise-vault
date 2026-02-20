import { FaHeart, FaShieldHalved } from 'react-icons/fa6';
import './Footer.css';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-content">
                <p className="footer-disclaimer">
                    <FaShieldHalved />
                    <span>WiseVault does not store any downloaded content or user data. All downloads are processed securely.</span>
                </p>
                <p className="footer-copy">
                    Made with <FaHeart className="footer-heart" /> by WiseVault &copy; {new Date().getFullYear()}
                </p>
            </div>
        </footer>
    );
}
