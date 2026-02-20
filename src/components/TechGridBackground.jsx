import { useEffect, useRef } from 'react';
import './TechGridBackground.css';

export default function TechGridBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', resize);
        resize();

        // ─── Stars ──────────────────────────────────────────────
        const stars = [];
        const STAR_COUNT = 160;
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 1.2 + 0.3,
                baseAlpha: Math.random() * 0.6 + 0.2,
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                twinkleOffset: Math.random() * Math.PI * 2,
            });
        }

        // ─── Nebula clouds ──────────────────────────────────────
        const nebulae = [
            {
                x: canvas.width * 0.2, y: canvas.height * 0.3,
                radius: 250, color: [80, 40, 120], alpha: 0.04,
                dx: 0.15, dy: -0.08,
            },
            {
                x: canvas.width * 0.75, y: canvas.height * 0.65,
                radius: 200, color: [30, 50, 100], alpha: 0.035,
                dx: -0.1, dy: 0.12,
            },
            {
                x: canvas.width * 0.5, y: canvas.height * 0.15,
                radius: 180, color: [40, 30, 80], alpha: 0.03,
                dx: 0.08, dy: 0.06,
            },
        ];

        // ─── Shooting stars ─────────────────────────────────────
        let shootingStars = [];
        let lastShootTime = 0;
        const SHOOT_INTERVAL = 5000; // one every ~5 seconds

        function createShootingStar() {
            const startX = Math.random() * canvas.width;
            const startY = Math.random() * canvas.height * 0.4;
            const angle = Math.PI / 6 + Math.random() * Math.PI / 6;
            const speed = 4 + Math.random() * 3;
            return {
                x: startX, y: startY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                length: 40 + Math.random() * 60,
                alpha: 1,
                decay: 0.015 + Math.random() * 0.01,
            };
        }

        // ─── Floating dust ──────────────────────────────────────
        const dust = [];
        const DUST_COUNT = 40;
        for (let i = 0; i < DUST_COUNT; i++) {
            dust.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 0.6 + 0.2,
                alpha: Math.random() * 0.15 + 0.05,
                vx: (Math.random() - 0.5) * 0.15,
                vy: (Math.random() - 0.5) * 0.1,
            });
        }

        let time = 0;

        const draw = (timestamp) => {
            time += 0.01;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // ─── Draw nebula clouds ─────────────────────────────
            for (const nb of nebulae) {
                nb.x += nb.dx;
                nb.y += nb.dy;

                // Bounce off edges softly
                if (nb.x < -nb.radius) nb.x = canvas.width + nb.radius;
                if (nb.x > canvas.width + nb.radius) nb.x = -nb.radius;
                if (nb.y < -nb.radius) nb.y = canvas.height + nb.radius;
                if (nb.y > canvas.height + nb.radius) nb.y = -nb.radius;

                const grad = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.radius);
                const [r, g, b] = nb.color;
                grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${nb.alpha})`);
                grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${nb.alpha * 0.4})`);
                grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(nb.x, nb.y, nb.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // ─── Draw stars with twinkling ──────────────────────
            for (const star of stars) {
                const twinkle = Math.sin(time * star.twinkleSpeed * 60 + star.twinkleOffset);
                const alpha = star.baseAlpha + twinkle * 0.2;
                const clampedAlpha = Math.max(0.05, Math.min(1, alpha));

                ctx.fillStyle = `rgba(220, 225, 255, ${clampedAlpha})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fill();

                // Some brighter stars get a subtle glow
                if (star.radius > 1 && clampedAlpha > 0.5) {
                    ctx.fillStyle = `rgba(200, 210, 255, ${clampedAlpha * 0.15})`;
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // ─── Draw floating dust ─────────────────────────────
            for (const d of dust) {
                d.x += d.vx;
                d.y += d.vy;

                // Wrap around
                if (d.x < 0) d.x = canvas.width;
                if (d.x > canvas.width) d.x = 0;
                if (d.y < 0) d.y = canvas.height;
                if (d.y > canvas.height) d.y = 0;

                ctx.fillStyle = `rgba(180, 190, 220, ${d.alpha})`;
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // ─── Draw shooting stars ────────────────────────────
            if (timestamp - lastShootTime > SHOOT_INTERVAL) {
                shootingStars.push(createShootingStar());
                lastShootTime = timestamp;
            }

            shootingStars = shootingStars.filter(s => s.alpha > 0.01);

            for (const s of shootingStars) {
                s.x += s.vx;
                s.y += s.vy;
                s.alpha -= s.decay;

                if (s.alpha <= 0) continue;

                const tailX = s.x - (s.vx / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length;
                const tailY = s.y - (s.vy / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length;

                const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
                grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
                grad.addColorStop(1, `rgba(255, 255, 255, ${s.alpha * 0.7})`);

                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(s.x, s.y);
                ctx.stroke();

                // Bright head
                ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        draw(0);

        const handleResize = () => {
            resize();
            // Redistribute stars on resize
            for (const star of stars) {
                star.x = Math.random() * canvas.width;
                star.y = Math.random() * canvas.height;
            }
        };

        window.removeEventListener('resize', resize);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="tech-grid-canvas"
        />
    );
}
