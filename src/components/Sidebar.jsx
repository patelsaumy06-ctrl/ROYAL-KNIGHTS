import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, LayoutDashboard, Search, Map, UploadCloud, Users, ListTodo, FileText, Bell, LogOut, Sparkles, HeartHandshake, Zap, X } from 'lucide-react';
import { G } from '../styles/theme';

const NAV = [
  { id: "landing", label: "Home", icon: Home, group: "Overview" },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { id: "insights", label: "Insights", icon: Sparkles, group: "Analysis" },
  { id: "map", label: "Map View", icon: Map, group: "Analysis" },
  { id: "communityNeeds", label: "Community Needs", icon: HeartHandshake, group: "Analysis" },
  { id: "pipeline", label: "Crisis Pipeline", icon: Zap, group: "Analysis" },
  { id: "upload", label: "Upload Data", icon: UploadCloud, group: "Analysis", badge: 3 },
  { id: "volunteers", label: "Volunteers", icon: Users, group: "Operations" },
  { id: "tasks", label: "Tasks", icon: ListTodo, group: "Operations" },
  { id: "reports", label: "Reports", icon: FileText, group: "System" },
  { id: "notifications", label: "Alerts", icon: Bell, group: "System" },
];

export default function Sidebar({ active, onNav, ngo, onLogout, unreadCount = 0, isMobile = false, isOpen = false, onClose }) {
  const [hovered, setHovered] = useState(null);
  const groups = [...new Set(NAV.map(n => n.group))];
  const initials = ngo ? ngo.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "NG";

  const sidebarContent = (
    <nav
      role={isMobile ? "dialog" : "navigation"}
      aria-label="Main navigation"
      style={{
        width: isMobile ? 280 : 240,
        background: "linear-gradient(195deg, #0B1120 0%, #0F172A 40%, #131C31 100%)",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0,
        zIndex: isMobile ? 200 : 100,
        overflow: "hidden",
        transform: isMobile && !isOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: isMobile && isOpen ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: -80, left: -40, width: 200, height: 200, background: "radial-gradient(circle,rgba(37,99,235,0.15),transparent 70%)", borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, right: -40, width: 180, height: 180, background: "radial-gradient(circle,rgba(139,92,246,0.12),transparent 70%)", borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none" }} />

      {/* Brand */}
      <div style={{ padding: "24px 22px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg,#2563EB,#8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            fontSize: 18
          }}>🤝</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.02em" }}>ReliefLink AI</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 3, fontWeight: 500 }}>Community Intel</div>
          </div>
        </div>
        {/* Close button for mobile */}
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            style={{
              background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.6)",
              width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: "8px 12px", overflowY: "auto", position: "relative", zIndex: 1 }}>
        {groups.map(g => (
          <div key={g}>
            <div style={{ fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", padding: "18px 10px 6px", fontWeight: 700 }}>{g}</div>
            {NAV.filter(n => n.group === g).map(n => {
              const isActive = active === n.id;
              const isHov = hovered === n.id;
              const Icon = n.icon;
              return (
                <a key={n.id} href="#"
                  onClick={e => { e.preventDefault(); onNav(n.id) }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 11, padding: isMobile ? "12px 14px" : "10px 12px", borderRadius: 10, cursor: "pointer",
                    color: isActive ? "#fff" : isHov ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)",
                    background: isActive ? "rgba(37,99,235,0.2)" : isHov ? "rgba(255,255,255,0.05)" : "transparent",
                    fontWeight: isActive ? 600 : 500, fontSize: isMobile ? 14.5 : 13.5, marginBottom: 2, textDecoration: "none",
                    transition: "all 0.2s ease", position: "relative", overflow: "hidden",
                    minHeight: isMobile ? 44 : 'auto',
                  }}>
                  {isActive && (
                    <motion.div layoutId="sidebar-active" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg,#3B82F6,#8B5CF6)", borderRadius: "0 4px 4px 0" }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon size={isMobile ? 20 : 18} strokeWidth={isActive ? 2.2 : 1.8} style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }} />
                  {n.label}
                  {(n.badge || (n.id === "notifications" && unreadCount > 0)) && (
                    <span style={{
                      marginLeft: "auto",
                      background: "linear-gradient(135deg,#EF4444,#DC2626)", color: "#fff",
                      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 100, minWidth: 20, textAlign: "center",
                      boxShadow: "0 2px 8px rgba(239,68,68,0.4)"
                    }}>{n.id === "notifications" ? unreadCount : n.badge}</span>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Card */}
      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, marginBottom: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
            boxShadow: "0 4px 12px rgba(99,102,241,0.3)"
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ngo?.name || "NGO"}</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ngo?.type || "Organisation"}</div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{
            width: "100%", padding: "9px 12px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
            color: "rgba(255,255,255,0.4)", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s ease", fontFamily: "'Inter',sans-serif",
            minHeight: 44,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#F87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)" }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </nav>
  );

  return sidebarContent;
}
