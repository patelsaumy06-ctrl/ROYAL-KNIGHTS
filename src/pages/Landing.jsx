import { motion } from 'framer-motion';
import { Users, MapPin, AlertTriangle, UploadCloud, CheckCircle, ArrowRight, Activity, Zap } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function Landing({onNav}) {
  const { isMobile, isTablet } = useMediaQuery();

  const features = [
    {icon:<Activity size={26} color="#3B82F6"/>,title:"AI Need Analysis",desc:"Processes cross-channel data to auto-prioritize community needs in real time.",bg:"rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)"},
    {icon:<Users size={26} color="#10B981"/>,title:"Smart Matching",desc:"Match volunteers by skill, proximity & AI compatibility scores for maximum impact.",bg:"rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)"},
    {icon:<MapPin size={26} color="#F59E0B"/>,title:"Live Needs Map",desc:"Geo-visualize urgency with color-coded pins. Instantly locate crises.",bg:"rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)"},
    {icon:<AlertTriangle size={26} color="#EF4444"/>,title:"Instant Alerts",desc:"Real-time intelligent notifications for urgent needs.",bg:"rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)"},
    {icon:<UploadCloud size={26} color="#8B5CF6"/>,title:"Multi-Format Ingestion",desc:"Ingest CSV, scanned forms, and voice recordings effortlessly.",bg:"rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.2)"},
    {icon:<CheckCircle size={26} color="#14B8A6"/>,title:"Gamification Engine",desc:"Keep volunteers engaged with smart dynamic leaderboards and badges.",bg:"rgba(20,184,166,0.1)", border: "rgba(20,184,166,0.2)"},
  ];

  return (
    <div style={{minHeight:"100%", background:"#FAFCFF", position:"relative", overflow:"hidden"}}>
      <div style={{position:"absolute",top:"-20%",left:"-10%",width:"60vw",height:"60vw",background:"radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 70%)",borderRadius:"50%",filter:"blur(80px)",zIndex:0}} />
      <div style={{position:"absolute",top:"20%",right:"-20%",width:"70vw",height:"70vw",background:"radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0) 70%)",borderRadius:"50%",filter:"blur(100px)",zIndex:0}} />
      <div style={{position:"absolute",bottom:"-10%",left:"20%",width:"50vw",height:"50vw",background:"radial-gradient(circle, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0) 70%)",borderRadius:"50%",filter:"blur(80px)",zIndex:0}} />
      
      <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: "linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)",
          backgroundSize: "40px 40px", opacity: 0.4
        }} 
      />
      
      <div style={{position:"relative", zIndex:1, maxWidth:1280, margin:"0 auto", padding: isMobile ? "40px 16px 60px" : isTablet ? "60px 24px 80px" : "80px 32px 120px"}}>
        {/* HERO SECTION */}
        <div style={{textAlign:"center", paddingTop: isMobile ? "20px" : "60px", paddingBottom: isMobile ? "40px" : "80px"}}>
          <motion.div initial={{opacity:0, scale:0.9, y:20}} animate={{opacity:1, scale:1, y:0}} transition={{duration:0.6, ease:[0.16,1,0.3,1]}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.7)",border:`1px solid rgba(255,255,255,0.9)`,boxShadow:"0 8px 32px rgba(37,99,235,0.1)",backdropFilter:"blur(16px)",borderRadius:100,padding: isMobile ? "8px 16px" : "10px 24px",fontSize: isMobile ? 12 : 13,color:"#2563EB",fontWeight:700,marginBottom: isMobile ? 24 : 36}}>
              <Zap size={18} color="#2563EB" fill="#2563EB"/>
              Introducing the Next-Gen Needlink AI
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{opacity:0, y:30}} animate={{opacity:1, y:0}} transition={{duration:0.7, delay:0.1, ease:[0.16,1,0.3,1]}}
            style={{fontFamily:"'Playfair Display',serif",fontSize: isMobile ? "clamp(32px, 8vw, 42px)" : "clamp(46px, 6.5vw, 84px)",lineHeight:1.1,color:"#0F172A",marginBottom: isMobile ? 20 : 28,maxWidth:950,margin:"0 auto 28px", letterSpacing:"-0.02em", padding: isMobile ? "0 8px" : 0}}
          >
            Transform Community Needs into <span style={{background:"linear-gradient(135deg, #2563EB, #8B5CF6, #EC4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontStyle:"italic"}}>Instant Action</span>
          </motion.h1>
          
          <motion.p 
            initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{duration:0.7, delay:0.2, ease:[0.16,1,0.3,1]}}
            style={{fontSize: isMobile ? 15 : 19,color:"#475569",maxWidth:640,margin:"0 auto 48px",lineHeight:1.8, padding: isMobile ? "0 12px" : 0}}
          >
            A perfectly orchestrated synergy of AI data parsing and real-time volunteer matching, built to respond to crises faster than ever before.
          </motion.p>
          
          <motion.div 
            initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{duration:0.7, delay:0.3, ease:[0.16,1,0.3,1]}}
            style={{display:"flex", alignItems:"center", justifyContent:"center", gap: isMobile ? 12 : 24, flexDirection: isMobile ? "column" : "row", padding: isMobile ? "0 16px" : 0}}
          >
            <button 
              onClick={()=>onNav("dashboard")}
              style={{
                background:"linear-gradient(135deg, #2563EB, #4F46E5)", color:"#fff", border:"none", borderRadius:100,
                padding: isMobile ? "16px 32px" : "18px 40px", fontSize: isMobile ? 15 : 16, fontWeight:700, display:"flex", alignItems:"center", gap:10,
                cursor:"pointer", boxShadow:"0 20px 40px -10px rgba(37,99,235,0.6)", transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                fontFamily:"'DM Sans',sans-serif", width: isMobile ? "100%" : "auto", justifyContent:"center", minHeight: 52,
              }}
              onMouseEnter={e => {e.currentTarget.style.transform = "translateY(-4px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 24px 48px -10px rgba(37,99,235,0.7)";}}
              onMouseLeave={e => {e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 20px 40px -10px rgba(37,99,235,0.6)";}}
            >
              Enter Dashboard <ArrowRight size={22}/>
            </button>
            <button 
              onClick={()=>onNav("insights")}
              style={{
                background:"rgba(255,255,255,0.8)", color:"#0F172A", border:"1px solid rgba(255,255,255,0.9)", borderRadius:100,
                padding: isMobile ? "16px 32px" : "18px 40px", fontSize: isMobile ? 15 : 16, fontWeight:600, cursor:"pointer",
                boxShadow:"0 10px 20px -10px rgba(0,0,0,0.06)", backdropFilter:"blur(12px)", transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                fontFamily:"'DM Sans',sans-serif", width: isMobile ? "100%" : "auto", justifyContent:"center", minHeight: 52,
              }}
              onMouseEnter={e => {e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow="0 15px 30px -10px rgba(0,0,0,0.1)";}}
              onMouseLeave={e => {e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "rgba(255,255,255,0.8)"; e.currentTarget.style.boxShadow="0 10px 20px -10px rgba(0,0,0,0.06)";}}
            >
              View Live Insights
            </button>
          </motion.div>
        </div>

        {/* STATS SECTION */}
        <motion.div 
          initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.8}}
          style={{background:"rgba(255,255,255,0.6)", border:"1px solid rgba(255,255,255,0.9)", backdropFilter:"blur(24px)", borderRadius: isMobile ? 20 : 32, padding: isMobile ? "28px 16px" : "48px 32px", display:"flex", justifyContent:"space-around", flexWrap:"wrap", gap: isMobile ? 20 : 30, boxShadow:"0 20px 40px rgba(0,0,0,0.04)", marginBottom: isMobile ? 60 : 100, position:"relative", zIndex:2}}
        >
          {[["1,240+","Active Volunteers", "#2563EB"], ["89%", "Resolution Rate", "#10B981"], ["342", "Needs Resolved Today", "#8B5CF6"], ["28", "Districts Covered", "#F59E0B"]].map(([n,l,c], i) => (
            <div key={l} style={{textAlign:"center", padding: isMobile ? "0 8px" : "0 20px", flex: isMobile ? "1 1 40%" : "1 1 200px"}}>
              <div style={{fontSize: isMobile ? "clamp(28px, 6vw, 36px)" : "clamp(36px, 4vw, 48px)", fontWeight:800, color:c, fontFamily:"'DM Sans',sans-serif", letterSpacing:"-0.03em", marginBottom:8}}>{n}</div>
              <div style={{fontSize: isMobile ? 12 : 14, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em"}}>{l}</div>
            </div>
          ))}
        </motion.div>

        {/* FEATURES GRID */}
        <div style={{textAlign:"center", marginBottom: isMobile ? 36 : 60}}>
          <h2 style={{fontFamily:"'Playfair Display',serif", fontSize: isMobile ? "clamp(26px, 6vw, 32px)" : "clamp(32px, 4vw, 46px)", color:"#0F172A", marginBottom:20}}>Intelligence at Every Step</h2>
          <p style={{fontSize: isMobile ? 14 : 17, color:"#64748B", maxWidth:560, margin:"0 auto", padding: isMobile ? "0 12px" : 0}}>Powerful tools seamlessly integrated to help NGOs manage communities efficiently and scale gracefully.</p>
        </div>

        <div style={{display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: isMobile ? 16 : 30, position:"relative", zIndex:2}}>
          {features.map((f, i) => (
            <motion.div 
              key={f.title}
              initial={{opacity:0, y:30}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.5, delay:i*0.1}}
              whileHover={!isMobile ? {y:-12, scale:1.02, transition:{duration:0.3, ease:"easeOut"}} : {}}
              style={{
                background:"rgba(255,255,255,0.6)", border:`1px solid rgba(255,255,255,0.7)`, borderTop:`1px solid ${f.border}`, borderLeft:`1px solid ${f.border}`, borderRadius: isMobile ? 20 : 28, padding: isMobile ? 24 : 36,
                boxShadow:"0 15px 35px rgba(0,0,0,0.03), inset 0 0 0 1px rgba(255,255,255,0.5)", backdropFilter:"blur(20px)", display:"flex", flexDirection:"column", cursor:"default"
              }}
            >
              <div style={{width: isMobile ? 52 : 64, height: isMobile ? 52 : 64, background:f.bg, borderRadius: isMobile ? 14 : 18, display:"flex", alignItems:"center", justifyContent:"center", marginBottom: isMobile ? 20 : 28}}>
                {f.icon}
              </div>
              <div style={{fontSize: isMobile ? 18 : 22, fontWeight:700, color:"#0F172A", marginBottom: isMobile ? 10 : 14, letterSpacing:"-0.01em"}}>{f.title}</div>
              <div style={{fontSize: isMobile ? 14 : 16, color:"#475569", lineHeight:1.7, flex:1}}>{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
