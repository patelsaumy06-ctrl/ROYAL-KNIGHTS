import { motion } from 'framer-motion';
import { G, css } from '../styles/theme';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function StatCard({label, value, delta, deltaColor, accent, icon}) {
  const isPositive = delta && (delta.includes("↑") || delta.includes("+"));
  const { isMobile } = useMediaQuery();

  return (
    <motion.div
      whileHover={!isMobile ? { y: -6, boxShadow: G.shadowXl } : {}}
      transition={{ type:"spring", stiffness: 400, damping: 25 }}
      style={{...css.card(), padding: isMobile ? 16 : 28, position:"relative", overflow:"hidden", cursor:"default"}}
    >
      {/* Top accent line */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${accent},${accent}66)`}}/>

      {/* Background decoration */}
      <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:`${accent}06`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-40,right:-20,width:80,height:80,borderRadius:"50%",background:`${accent}04`,pointerEvents:"none"}}/>

      {/* Icon */}
      <div style={{
        width: isMobile ? 40 : 52, height: isMobile ? 40 : 52, borderRadius: isMobile ? 10 : 14,
        background:`linear-gradient(135deg,${accent}14,${accent}08)`,
        border:`1px solid ${accent}18`,
        display:"flex",alignItems:"center",justifyContent:"center",marginBottom: isMobile ? 14 : 20
      }}>
        {icon}
      </div>

      {/* Label */}
      <div style={{fontSize: isMobile ? 10.5 : 12,color:G.t3,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom: isMobile ? 6 : 10,fontWeight:600}}>{label}</div>

      {/* Value */}
      <div style={{fontSize: isMobile ? 26 : 38,fontWeight:800,color:G.t1,lineHeight:1,letterSpacing:"-1.5px",fontFamily:"'Inter',sans-serif"}}>{value}</div>

      {/* Delta */}
      <div style={{
        display:"inline-flex",alignItems:"center",gap:5,marginTop: isMobile ? 10 : 14,
        fontSize: isMobile ? 10.5 : 12, fontWeight:600, color:deltaColor || (isPositive ? G.green : G.t3),
        background: isPositive ? G.greenLight : G.bg,
        padding: isMobile ? "3px 8px" : "4px 10px", borderRadius:100
      }}>
        {isPositive ? <TrendingUp size={isMobile ? 11 : 13}/> : <TrendingDown size={isMobile ? 11 : 13}/>}
        {delta}
      </div>
    </motion.div>
  );
}
