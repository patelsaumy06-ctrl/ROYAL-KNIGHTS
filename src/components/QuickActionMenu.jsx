import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, ClipboardList, Upload, X, AlertTriangle, Bot } from 'lucide-react';

export default function QuickActionMenu({ onAction, isMobile = false }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);

  const actions = [
    { id: 'emergency', label: '🚨 Emergency Mode', icon: <AlertTriangle size={20} />, color: "#EF4444", bg: "#FEF2F2" },
    { id: 'smartAssign', label: '🤖 Smart Assign', icon: <Bot size={20} />, color: "#F59E0B", bg: "#FFFBEB" },
    { id: 'task', label: 'New Task', icon: <ClipboardList size={20} />, color: "#2563EB", bg: "#EFF6FF" },
    { id: 'volunteer', label: 'Add Volunteer', icon: <Users size={20} />, color: "#10B981", bg: "#F0FDF4" },
    { id: 'upload', label: 'Upload Data', icon: <Upload size={20} />, color: "#8B5CF6", bg: "#F5F3FF" },
  ];

  return (
    <div style={{ position: "fixed", bottom: isMobile ? 20 : 40, right: isMobile ? 16 : 40, zIndex: 1000 }}>
      {/* Background Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.4)", backdropFilter: "blur(4px)", zIndex: -1 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{ position: "absolute", bottom: isMobile ? 64 : 80, right: 0, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end", minWidth: isMobile ? 180 : 200 }}
          >
            {actions.map((act, i) => (
              <motion.button
                key={act.id}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                transition={{ delay: (actions.length - i) * 0.05 }}
                onClick={() => { setIsOpen(false); onAction && onAction(act.id); }}
                style={{ 
                  display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "10px 16px" : "12px 20px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.8)",
                  background: "rgba(255,255,255,0.9)", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", backdropFilter: "blur(12px)", cursor: "pointer",
                  color: "#0F172A", fontWeight: 600, fontSize: isMobile ? 13 : 15, fontFamily: "'DM Sans', sans-serif",
                  minHeight: 44,
                }}
                whileHover={{ scale: 1.05, background: "#FFF" }}
                whileTap={{ scale: 0.95 }}
              >
                {act.label}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: act.bg, color: act.color }}>
                  {act.icon}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={toggle}
        whileHover={{ scale: 1.05, boxShadow: "0 20px 30px rgba(37,99,235,0.4)" }}
        whileTap={{ scale: 0.95 }}
        aria-label="Quick actions menu"
        style={{
          width: isMobile ? 52 : 64, height: isMobile ? 52 : 64, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #4F46E5)", color: "#fff",
          border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: "0 10px 25px rgba(37,99,235,0.3)", zIndex: 10
        }}
      >
        <motion.div animate={{ rotate: isOpen ? 135 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          {isOpen ? <X size={isMobile ? 22 : 28} /> : <Plus size={isMobile ? 22 : 28} />}
        </motion.div>
      </motion.button>
    </div>
  );
}
