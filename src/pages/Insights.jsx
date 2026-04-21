import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { G, css } from '../styles/theme';
import { api } from '../services/api';
import BarChart from '../components/BarChart';
import Tag from '../components/Tag';
import Spinner from '../components/Spinner';
import { Sparkles, TrendingUp, AlertTriangle, MapPin, ArrowRight, Zap, Package, Stethoscope } from 'lucide-react';
import EmergencyAIInsights from '../components/EmergencyAIInsights';
import PredictionDashboard from '../components/PredictionDashboard';
import { useMediaQuery } from '../hooks/useMediaQuery';

const fadeIn = (delay=0) => ({initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:0.5,delay,ease:[0.16,1,0.3,1]}});

export default function Insights({ onNav, onEmergencyActivated, intelligence = null, smartMode = false }) {
  const [needs,setNeeds] = useState([]);
  const [chart,setChart] = useState(null);
  const [filter,setFilter] = useState("all");
  const [loading,setLoading] = useState(true);
  const { isMobile, isTablet } = useMediaQuery();

  useEffect(()=>{
    Promise.all([api.getNeeds(),api.getChartData()])
      .then(([n,c])=>{ setNeeds(n); setChart(c); setLoading(false); });
  },[]);

  if(loading) return <Spinner/>;

  const filtered = filter==="all" ? needs : needs?.filter(n=>n.priority===filter) || [];
  const chips = ["all","urgent","medium","low"];
  const predictions = intelligence?.predictions || [];
  const priorityTasks = intelligence?.prioritizedTasks || [];
  const hotspots = intelligence?.hotspotList || [];

  const priorityConfig = {
    urgent: { color: G.red, gradient: "linear-gradient(135deg,#FEF2F2,#FEE2E2)", border: "#FECACA", icon: <AlertTriangle size={18} color={G.red}/>, label: "Critical Priority" },
    medium: { color: G.amber, gradient: "linear-gradient(135deg,#FFFBEB,#FEF3C7)", border: "#FDE68A", icon: <Zap size={18} color={G.amber}/>, label: "Medium Priority" },
    low:    { color: G.green, gradient: "linear-gradient(135deg,#ECFDF5,#D1FAE5)", border: "#A7F3D0", icon: <Package size={18} color={G.green}/>, label: "Low Priority" },
  };

  return (
    <motion.div {...fadeIn()} style={{padding: isMobile ? "16px 12px 48px" : "28px 32px 48px"}}>
      {/* Header with AI badge */}
      <motion.div {...fadeIn(0.05)} style={{marginBottom:28}}>
        <div style={{display:"flex",flexDirection: isMobile ? "column" : "row",alignItems: isMobile ? "flex-start" : "center",justifyContent:"space-between",marginBottom:8, gap: isMobile ? 12 : 0}}>
          <div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#EFF6FF,#EEF2FF)",border:"1px solid #DBEAFE",borderRadius:100,padding:"5px 14px",fontSize:11.5,color:G.blue,fontWeight:700,marginBottom:14}}>
              <Sparkles size={13}/> AI-Generated Insights
            </div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:G.t1,letterSpacing:"-0.02em",margin:0}}>Community Need Analysis</h2>
          </div>
          <div style={{display:"flex",gap:10, flexWrap:"wrap"}}>
            {chips.map(c=>(
              <button key={c} onClick={()=>setFilter(c)}
                style={{
                  padding:"8px 18px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",
                  border:`1.5px solid ${filter===c?G.blue:"transparent"}`,
                  background:filter===c?G.blueLight:G.surface,
                  color:filter===c?G.blue:G.t2,
                  transition:"all 0.2s ease",
                  boxShadow:filter===c?`0 0 0 3px ${G.blue}10`:G.shadow
                }}>
                {c.charAt(0).toUpperCase()+c.slice(1)} {filter===c && `(${filtered.length})`}
              </button>
            ))}
          </div>
        </div>
        {smartMode && (
          <div style={{marginTop:12,padding:'10px 14px',borderRadius:12,background:'linear-gradient(135deg,#ECFDF5,#D1FAE5)',border:'1px solid #A7F3D0',fontSize:12.5,color:G.greenDark,fontWeight:600}}>
            Smart Mode is ON: predictions and autonomous recommendations are live.
          </div>
        )}
      </motion.div>

      <motion.div {...fadeIn(0.07)}>
        <PredictionDashboard
          predictions={predictions}
          hotspots={hotspots}
          smartMode={smartMode}
          onNav={onNav}
        />
      </motion.div>

      <motion.div {...fadeIn(0.08)} style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap: isMobile ? 14 : 20,marginBottom:24}}>
        <div style={css.card()}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${G.border}`,...css.flex(0,'center','space-between')}}>
            <div style={{fontSize:14,fontWeight:700,color:G.t1}}>Predicted Alerts</div>
            <Tag type="urgent">{predictions.length} Active</Tag>
          </div>
          <div style={{padding:16,display:'grid',gap:10}}>
            {predictions.slice(0,4).map((p) => (
              <div key={p.id} style={{padding:'10px 12px',borderRadius:10,background:'#FEF2F2',border:'1px solid #FECACA'}}>
                <div style={{fontSize:12.5,fontWeight:700,color:'#B91C1C'}}>{p.predictedNeedType} · {p.location}</div>
                <div style={{fontSize:11.5,color:G.t2,marginTop:2}}>{p.reason}</div>
                <div style={{fontSize:11,color:G.t3,marginTop:4}}>Urgency: {p.urgencyLevel} · Confidence: {p.confidenceScore}%</div>
              </div>
            ))}
            {predictions.length === 0 && <div style={{fontSize:12,color:G.t3}}>No emerging crisis patterns detected yet.</div>}
          </div>
        </div>

        <div style={css.card()}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${G.border}`,...css.flex(0,'center','space-between')}}>
            <div style={{fontSize:14,fontWeight:700,color:G.t1}}>High-Need Areas</div>
            <Tag type="medium">Heat Ranking</Tag>
          </div>
          <div style={{padding:16,display:'grid',gap:8}}>
            {hotspots.slice(0,5).map((h) => (
              <div key={h.region} style={{...css.flex(8,'center','space-between'),padding:'8px 10px',borderRadius:10,background:G.bg}}>
                <span style={{fontSize:12.5,color:G.t1,fontWeight:600}}>{h.region}</span>
                <span style={{fontSize:12,color:G.red,fontWeight:700}}>Risk Score {h.score}</span>
              </div>
            ))}
            {hotspots.length === 0 && <div style={{fontSize:12,color:G.t3}}>No hotspots available.</div>}
          </div>
        </div>
      </motion.div>

      {/* Priority Cards */}
      <motion.div {...fadeIn(0.1)} style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3,1fr)",gap: isMobile ? 14 : 20,marginBottom:28}}>
        {["urgent","medium","low"].map((p,idx)=>{
          const cfg = priorityConfig[p];
          const pNeeds = needs?.filter(n=>n.priority===p) || [];
          return (
            <motion.div key={p} {...fadeIn(0.1+idx*0.05)}
              style={{
                background:cfg.gradient, border:`1px solid ${cfg.border}`,
                borderRadius:18, overflow:"hidden", position:"relative"
              }}
            >
              {/* Top accent */}
              <div style={{height:3,background:cfg.color}}/>
              <div style={{padding:"20px 22px 14px",...css.flex(0,"center","space-between")}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:34,height:34,borderRadius:10,background:`${cfg.color}18`,border:`1px solid ${cfg.color}25`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {cfg.icon}
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:cfg.color}}>{cfg.label}</div>
                    <div style={{fontSize:11,color:G.t3}}>{pNeeds.length} needs identified</div>
                  </div>
                </div>
              </div>
              <div style={{padding:"0 22px 18px"}}>
                {pNeeds.map((n,i)=>(
                  <div key={n.id} style={{...css.flex(10,"flex-start"),padding:"11px 0",borderBottom:i<pNeeds.length-1?`1px solid ${cfg.border}`:"none"}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:cfg.color,flexShrink:0,marginTop:5}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:G.t1}}>{n.category}</div>
                      <div style={{fontSize:11.5,color:G.t3,display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                        <MapPin size={10}/>{n.location} · {n.region}
                      </div>
                    </div>
                  </div>
                ))}
                {pNeeds.length===0 && <div style={{fontSize:12.5,color:G.t3,padding:"12px 0"}}>No {p} needs</div>}
                {p==="urgent" && pNeeds.length > 0 && (
                  <button style={{...css.btn("danger"),width:"100%",justifyContent:"center",marginTop:14,fontSize:13,borderRadius:10}} onClick={()=>onNav("volunteers")}>
                    Match Volunteers <ArrowRight size={14}/>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts + AI Recommendations */}
      <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap: isMobile ? 14 : 22}}>
        <motion.div {...fadeIn(0.2)} style={css.card()}>
          <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${G.border}`,...css.flex(0,"center","space-between")}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:G.t1,letterSpacing:"-0.02em"}}>Needs Trend Over Time</div>
              <div style={{fontSize:12,color:G.t3,marginTop:2}}>6-month trend analysis</div>
            </div>
            <div style={{...css.tag(G.greenLight,G.green)}}><TrendingUp size={12}/> Growing</div>
          </div>
          <div style={{padding:24}}>
            {chart && <BarChart data={chart?.trends?.map(t=>({...t,color:G.blue})) || []} height={160}/>}
          </div>
        </motion.div>

        <motion.div {...fadeIn(0.25)} style={css.card()}>
          <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${G.border}`,...css.flex(0,"center","space-between")}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Sparkles size={16} color={G.violet}/>
              <div style={{fontSize:15,fontWeight:700,color:G.t1,letterSpacing:"-0.02em"}}>AI Recommendations</div>
            </div>
          </div>
          <div style={{padding:22,display:"flex",flexDirection:"column",gap:14}}>
            {priorityTasks.slice(0,3).map((task)=>(
              <div key={task.id} style={{
                background:task.priorityLabel === 'Critical' ? 'linear-gradient(135deg,#FEF2F2,#FFF1F2)' : 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
                border:`1px solid ${task.priorityLabel === 'Critical' ? '#FECACA' : '#BFDBFE'}`,borderRadius:14,padding:"16px 18px",
                display:"flex",alignItems:"flex-start",gap:12,transition:"all 0.2s ease",cursor:"default"
              }}
                onMouseEnter={e=>e.currentTarget.style.transform="translateX(4px)"}
                onMouseLeave={e=>e.currentTarget.style.transform="translateX(0)"}
              >
                <div style={{width:34,height:34,borderRadius:10,background:`${task.priorityLabel === 'Critical' ? G.red : G.blue}14`,border:`1px solid ${task.priorityLabel === 'Critical' ? G.red : G.blue}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Sparkles size={16} color={task.priorityLabel === 'Critical' ? G.red : G.blue}/>
                </div>
                <div>
                  <div style={{fontSize:13.5,fontWeight:700,color:task.priorityLabel === 'Critical' ? G.red : G.blue,marginBottom:3}}>
                    {task.category} · Score {task.priorityScore}
                  </div>
                  <div style={{fontSize:12.5,color:G.t2,lineHeight:1.5}}>
                    {task.location} ({task.region}) requires {task.volunteers - task.assigned} more volunteers.
                  </div>
                </div>
              </div>
            ))}
            {priorityTasks.length === 0 && <div style={{fontSize:12,color:G.t3}}>No prioritized tasks available.</div>}
          </div>
        </motion.div>
      </div>

      {/* Emergency & AI Insights Section */}
      <motion.div {...fadeIn(0.35)} style={{ marginTop: 28 }}>
        <EmergencyAIInsights
          onNav={onNav}
          onEmergencyActivated={onEmergencyActivated}
          onNeedsRefresh={() => api.getNeeds().then(setNeeds)}
        />
      </motion.div>
    </motion.div>
  );
}
