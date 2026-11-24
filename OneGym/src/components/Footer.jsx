import { Link } from 'react-router';
import './Footer.css';

export function Footer() {
    return (
        <>
        <footer className="footer">
            <div className="footer-inner">
                <div className="footer-top">
                    <Link className="footer-logo" to="/">OneGym</Link>
                    <ul className="footer-links">
                        <li><Link to="/#features">About us</Link></li>
                        <li><Link to="/support">Contact</Link></li>
                        <li><Link to="/support">Support</Link></li>
                        <li><Link to="/pricing">Pricing</Link></li>
                    </ul>
                </div>
                <div className="footer-bottom">
                    <span>&copy; 2026 OneGym. All rights reserved.</span>
                    <div className="footer-legal">
                        <Link to="/terms">Terms of use</Link>
                        <Link to="/privacy">Privacy policy</Link>
                        <Link to="/support">Contact support</Link>
                    </div>
                </div>
            </div>
        </footer>
        </>
    );
}


