import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Bot, User, Brain } from 'lucide-react';
import { G } from '../styles/theme';
import { ASSISTANT_MODES, buildModeAwareFallback } from '../services/assistantModes';

export default function AIAssistant({ emergency, riskScore = 0, aiSnapshot, isMobile = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', content: "Hello! I'm your ReliefLink AI assistant. How can I help you optimize crisis response today?" }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState('coordinator');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!aiSnapshot) return;
    setMessages((prev) => {
      const signal = `AI Monitor: ${aiSnapshot.leadMessage} ${aiSnapshot.deployMessage}`;
      if (prev.some((m) => m.role === 'bot' && m.content === signal)) return prev;
      return [...prev, { role: 'bot', content: signal }];
    });
  }, [aiSnapshot]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          mode,
          context: {
            emergencyMode: emergency,
            riskScore,
            aiSnapshot,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to reach chat service.');
      }

      const classification = String(payload?.classification || 'other')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      const location = payload?.details?.location || 'Unknown';
      const urgency = payload?.details?.urgency || 'unknown';
      const type = payload?.details?.type || 'General';
      const botReply = payload?.response || 'No response available.';
      const activeModeLabel = ASSISTANT_MODES[mode]?.label || ASSISTANT_MODES.coordinator.label;

      const formatted = `Mode: ${activeModeLabel}\nClassification: ${classification}\nLocation: ${location}\nUrgency: ${urgency}\nType: ${type}\n\n${botReply}`;
      setMessages(prev => [...prev, { role: 'bot', content: formatted }]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "AI service is currently unreachable.";
      const fallback = buildModeAwareFallback(mode, userMsg);
      setMessages(prev => [...prev, { role: 'bot', content: `Error: ${message}\n\nFallback guidance:\n${fallback}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Mobile: full-screen chat window. Desktop: floating card.
  const chatWindowStyle = isMobile ? {
    position: 'fixed',
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: 0,
    boxShadow: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1100
  } : {
    position: 'fixed',
    bottom: 180,
    right: 32,
    width: 380,
    height: 520,
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    borderRadius: 30,
    boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.6)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Open AI assistant"
        style={{
          position: 'fixed',
          bottom: isMobile ? 80 : 112,
          right: isMobile ? 16 : 32,
          width: isMobile ? 48 : 56,
          height: isMobile ? 48 : 56,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 12px 32px rgba(37,99,235,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 999
        }}
      >
        <Sparkles size={isMobile ? 22 : 28} />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0, 0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 26,
            border: '2px solid #6366F1'
          }}
        />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={chatWindowStyle}
          >
            {/* Header */}
            <div style={{
              padding: isMobile ? '16px 20px' : '24px',
              background: 'linear-gradient(to right, #2563EB, #7C3AED)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>ReliefLink AI</div>
                  <div style={{ fontSize: 11, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
                    Analyzing live telemetry
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} aria-label="Close AI assistant" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            {/* AI Summary Dashboard - Decision System */}
            <div style={{
              margin: isMobile ? '0 12px 12px' : '0 24px 16px',
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(139,92,246,0.06))',
              borderRadius: 14,
              border: '1px solid rgba(37,99,235,0.12)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Brain size={13} color={G.blue} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: G.blue, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Live AI Summary</span>
                {emergency && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                    background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA',
                    marginLeft: 'auto',
                  }}>🚨 EMERGENCY</span>
                )}
              </div>
                <div style={{ fontFamily: "'SF Mono','Fira Code','Consolas',monospace", fontSize: 11.5, lineHeight: 1.8, color: G.t1 }}>
                <div>⚡ Risk score: <span style={{ color: riskScore > 70 ? '#EF4444' : G.green, fontWeight: 700 }}>{riskScore}/100</span></div>
                <div>🧠 {aiSnapshot?.leadMessage || 'Monitoring active reports'}</div>
                {!isMobile && <div>🚀 {aiSnapshot?.deployMessage || 'Standby deployment strategy ready'}</div>}
              </div>
            </div>

            <div style={{ margin: isMobile ? '0 12px 8px' : '0 24px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              {Object.values(ASSISTANT_MODES).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: mode === item.id ? `1px solid ${G.blue}` : '1px solid rgba(15,23,42,0.12)',
                    background: mode === item.id ? 'rgba(37,99,235,0.12)' : '#fff',
                    color: mode === item.id ? G.blue : G.t2,
                    cursor: 'pointer',
                    minHeight: 32,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 12px 12px' : '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {messages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  gap: 10,
                  flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: m.role === 'user' ? G.blue : '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {m.role === 'user' ? <User size={16} color="#fff" /> : <Bot size={16} color={G.blue} />}
                  </div>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: m.role === 'user' ? '18px 2px 18px 18px' : '2px 18px 18px 18px',
                    background: m.role === 'user' ? G.blue : '#fff',
                    color: m.role === 'user' ? '#fff' : G.t1,
                    fontSize: 13,
                    lineHeight: 1.5,
                    boxShadow: m.role === 'user' ? '0 4px 12px rgba(37,99,235,0.25)' : '0 4px 12px rgba(0,0,0,0.03)',
                    border: '1px solid rgba(0,0,0,0.03)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={16} color={G.blue} />
                  </div>
                  <div style={{ padding: '12px 20px', borderRadius: '2px 18px 18px 18px', background: '#F1F5F9', display: 'flex', gap: 4 }}>
                    <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: 4, height: 4, borderRadius: '50%', background: G.t3 }} />
                    <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} style={{ width: 4, height: 4, borderRadius: '50%', background: G.t3 }} />
                    <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} style={{ width: 4, height: 4, borderRadius: '50%', background: G.t3 }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: isMobile ? '12px' : '20px', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#fff', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10, background: '#F8FAFC', padding: '8px 8px 8px 16px', borderRadius: 16, border: '1px solid #E2E8F0' }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder={isTyping ? "Analyzing..." : "Ask any question about the data..."}
                  disabled={isTyping}
                  style={{ flex: 1, background: 'none', border: 'none', fontSize: 13, color: G.t1, outline: 'none', minHeight: 36 }}
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  aria-label="Send message"
                  style={{ 
                    width: 40, height: 40, borderRadius: 12, background: G.blue, color: '#fff', border: 'none', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s', opacity: input.trim() && !isTyping ? 1 : 0.5,
                    flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                {['Stats summary', 'Urgent needs', 'Volunteer matching', 'Emergency status'].map(suggestion => (
                  <button 
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    style={{ 
                      whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 100, background: 'rgba(37,99,235,0.05)', 
                      border: '1px solid rgba(37,99,235,0.1)', color: G.blue, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s', minHeight: 32, flexShrink: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,99,235,0.05)'}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
