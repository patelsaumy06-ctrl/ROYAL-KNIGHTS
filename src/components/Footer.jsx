import { useMediaQuery } from '../hooks/useMediaQuery';
import { Heart, Mail, ExternalLink } from 'lucide-react';

export default function Footer({ onNav }) {
  const { isMobile, isTablet } = useMediaQuery();

  const linkStyle = {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
    transition: 'color 0.2s',
    textDecoration: 'none',
    display: 'block',
    padding: '4px 0',
  };

  const Link = ({ label, page }) => (
    <span
      style={linkStyle}
      onClick={() => onNav?.(page)}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#60A5FA')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
    >
      {label}
    </span>
  );

  return (
    <footer
      style={{
        background: 'linear-gradient(160deg, #0B1120 0%, #0F172A 50%, #1E293B 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1280,
          margin: '0 auto',
          padding: isMobile ? '48px 20px 32px' : '72px 32px 40px',
        }}
      >
        {/* Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '2fr 1fr 1fr 1fr',
            gap: isMobile ? 36 : 48,
            marginBottom: isMobile ? 36 : 48,
          }}
        >
          {/* Brand column */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #2563EB, #8B5CF6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                🤝
              </div>
              <span
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  color: '#fff',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                NeedLink{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #60A5FA, #A78BFA)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  AI
                </span>
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.8,
                maxWidth: 300,
              }}
            >
              AI-powered crisis response platform helping NGOs detect urgent needs, match
              volunteers, and coordinate humanitarian relief in real-time.
            </p>
          </div>

          {/* Platform links */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: 16,
              }}
            >
              Platform
            </div>
            <Link label="Dashboard" page="dashboard" />
            <Link label="Crisis Map" page="map" />
            <Link label="Tasks" page="tasks" />
            <Link label="Volunteers" page="volunteers" />
            <Link label="Reports" page="reports" />
          </div>

          {/* Company links */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: 16,
              }}
            >
              Company
            </div>
            <Link label="About" page="about" />
            <Link label="Contact" page="contact" />
            <Link label="Privacy Policy" page="privacy" />
            <Link label="Terms of Service" page="terms" />
          </div>

          {/* Connect */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: 16,
              }}
            >
              Connect
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {[
                { icon: <Mail size={18} />, label: 'Email' },
                { icon: <ExternalLink size={18} />, label: 'GitHub' },
                { icon: <ExternalLink size={18} />, label: 'Twitter' },
              ].map((s) => (
                <div
                  key={s.label}
                  title={s.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(37,99,235,0.2)';
                    e.currentTarget.style.color = '#60A5FA';
                    e.currentTarget.style.borderColor = 'rgba(37,99,235,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  {s.icon}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
            marginBottom: isMobile ? 20 : 28,
          }}
        />

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'center' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 12 : 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              textAlign: isMobile ? 'center' : 'left',
            }}
          >
            © 2026 NeedLink AI. All rights reserved.
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Built with <Heart size={12} color="#EF4444" fill="#EF4444" /> for the organizations that
            save lives.
          </div>
        </div>
      </div>
    </footer>
  );
}
