import { G, css } from '../styles/theme';

export default function ProgressBar({label, value, max=100, color=G.blue}) {
  const pct = Math.round((value/max)*100);
  return (
    <div style={{marginBottom:14}}>
      <div style={{...css.flex(0,"center","space-between"),marginBottom:7}}>
        <span style={{fontSize:12,color:G.t2,fontWeight:500}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color:G.t1}}>{value}<span style={{fontSize:10,color:G.t3,fontWeight:400}}> /{max}</span></span>
      </div>
      <div style={{background:G.bg,borderRadius:100,height:7,overflow:"hidden",border:`1px solid ${G.border}`}}>
        <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${color},${color}cc)`,height:"100%",borderRadius:100,transition:"width 1s ease"}}/>
      </div>
    </div>
  );
}
