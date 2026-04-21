/* ═══════════════════════════ DESIGN TOKENS & HELPERS ═══════════════════════════ */

export const G = {
  // Primary
  blue:"#2563EB", blueLight:"#EFF6FF", blueMid:"#DBEAFE", blueDark:"#1D4ED8",
  // Success
  green:"#10B981", greenLight:"#ECFDF5", greenDark:"#059669",
  // Danger
  red:"#EF4444", redLight:"#FEF2F2", redDark:"#DC2626",
  // Warning
  amber:"#F59E0B", amberLight:"#FFFBEB", amberDark:"#D97706",
  // Accent
  indigo:"#6366F1", indigoLight:"#EEF2FF", violet:"#8B5CF6",
  pink:"#EC4899",
  // Surfaces
  bg:"#F8FAFC", surface:"#FFFFFF", border:"#E2E8F0", borderLight:"#F1F5F9",
  // Text
  t1:"#0F172A", t2:"#475569", t3:"#94A3B8", t4:"#CBD5E1",
  // Shadows — elevated, layered
  shadow:"0 1px 3px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.03)",
  shadowMd:"0 4px 6px -1px rgba(15,23,42,0.06), 0 10px 20px -2px rgba(15,23,42,0.05)",
  shadowLg:"0 10px 25px -3px rgba(15,23,42,0.08), 0 20px 50px -5px rgba(15,23,42,0.05)",
  shadowXl:"0 20px 50px -10px rgba(15,23,42,0.12), 0 8px 20px -4px rgba(15,23,42,0.06)",
  // Glassmorphism
  glass:"rgba(255,255,255,0.7)",
  glassBorder:"rgba(255,255,255,0.9)",
  glassBlur:"blur(20px)",
};

export const css = {
  flex: (gap=0,align="center",justify="flex-start") => ({display:"flex",alignItems:align,justifyContent:justify,gap}),
  card: (extra={}) => ({
    background:G.surface, border:`1px solid ${G.border}`, borderRadius:16, overflow:"hidden",
    boxShadow:G.shadow, transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)", ...extra
  }),
  glassCard: (extra={}) => ({
    background:G.glass, border:`1px solid ${G.glassBorder}`, borderRadius:20, overflow:"hidden",
    boxShadow:G.shadowMd, backdropFilter:G.glassBlur, transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)", ...extra
  }),
  tag: (bg,color) => ({
    background:bg, color, fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:100,
    display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap", letterSpacing:"0.02em"
  }),
  btn: (variant="primary",sm=false) => {
    const base = {
      border:"none", borderRadius:12, fontFamily:"'Inter',sans-serif", fontWeight:600,
      cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8,
      transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)", whiteSpace:"nowrap", letterSpacing:"-0.01em"
    };
    const pad = sm ? {padding:"8px 18px",fontSize:13,borderRadius:10} : {padding:"12px 28px",fontSize:14};
    if(variant==="primary") return {...base,...pad,background:`linear-gradient(135deg,${G.blue},${G.indigo})`,color:"#fff",boxShadow:`0 4px 14px ${G.blue}33`};
    if(variant==="green")   return {...base,...pad,background:`linear-gradient(135deg,${G.green},${G.greenDark})`,color:"#fff",boxShadow:`0 4px 14px ${G.green}33`};
    if(variant==="danger")  return {...base,...pad,background:G.redLight,color:G.red,border:`1px solid #FECACA`};
    return {...base,...pad,background:G.surface,color:G.t1,border:`1px solid ${G.border}`,boxShadow:"0 1px 3px rgba(0,0,0,0.02)"};
  },
};
