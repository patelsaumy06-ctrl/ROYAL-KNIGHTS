import { useState } from 'react';

export default function AuthInput({icon, type="text", value, onChange, placeholder, error, right}) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{position:"relative"}}>
      <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none",zIndex:1}}>{icon}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required
        style={{width:"100%",padding:`11px ${right?40:12}px 11px 38px`,border:`1px solid ${error?"#FECACA":focus?"#2563EB":"#E8EDF5"}`,borderRadius:10,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#0F172A",outline:"none",transition:"border 0.15s",background:error?"#FEF2F2":"#fff",boxSizing:"border-box"}}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}/>
      {right}
    </div>
  );
}

export function AuthLogo() {
  return (
    <div style={{textAlign:"center",marginBottom:32}}>
      <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:60,height:60,borderRadius:16,background:"linear-gradient(135deg,#2563EB,#6366F1)",marginBottom:14,boxShadow:"0 8px 24px rgba(37,99,235,0.25)"}}>
        <span style={{fontSize:28}}>🤝</span>
      </div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#0F172A",lineHeight:1.2}}>Needlink AI</div>
      <div style={{fontSize:12,color:"#94A3B8",letterSpacing:1,textTransform:"uppercase",marginTop:4}}>NGO Portal</div>
    </div>
  );
}
