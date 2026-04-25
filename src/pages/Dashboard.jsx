import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Users, CheckCircle2, AlertTriangle, ArrowRight, Clock, MapPin, Sparkles, TrendingUp, Brain, ShieldAlert, Radio } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { G, css } from '../styles/theme';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import ProgressBar from '../components/ProgressBar';
import Tag from '../components/Tag';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { predictNeeds, calculateRiskScore } from '../core';


const fadeIn = (delay=0) => ({initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:0.5,delay,ease:[0.16,1,0.3,1]}});

const buildLiveStats = (needs, volunteerCount) => ({
  totalNeeds: needs.filter((n) => n.status !== 'resolved').length,
  volunteers: volunteerCount,
  resolved: needs.filter((n) => n.status === 'resolved').length,
  urgent: needs.filter((n) => n.priority === 'urgent' && n.status !== 'resolved').length,
});

const buildLiveChart = (needs) => {
  const categoriesMap = {};
  const regionsMap = {};
  const resolvedMap = {};
  needs.forEach((n) => {
    categoriesMap[n.category] = (categoriesMap[n.category] || 0) + 1;
    regionsMap[n.region] = (regionsMap[n.region] || 0) + 1;
    if (n.status === 'resolved') resolvedMap[n.category] = (resolvedMap[n.category] || 0) + 1;
  });

  return {
    categories: Object.entries(categoriesMap).map(([label, value]) => ({ label, value, color: G.blue })),
    regions: Object.entries(regionsMap).map(([label, value]) => ({ label, value })),
    resolution: Object.entries(categoriesMap).map(([label, total]) => ({
      label,
      value: total ? Math.round(((resolvedMap[label] || 0) / total) * 100) : 0,
    })),
  };
};

export default function Dashboard({onNav, emergency, onDeactivateEmergency, riskScore = 0, aiInsight = "", needsOverride = null}) {
  const [stats,setStats]   = useState(null);
  const [needs,setNeeds]   = useState(null);
  const [chart,setChart]   = useState(null);
  const [loading,setLoading] = useState(true);
  const { isMobile, isTablet, isDesktop } = useMediaQuery();

  const needsKey = JSON.stringify(needsOverride ?? []);

  useEffect(()=>{
    const load = async () => {
      if (Array.isArray(needsOverride) && needsOverride.length > 0) {
        const volunteers = await api.getVolunteers();
        setNeeds(needsOverride);
        setStats(buildLiveStats(needsOverride, volunteers.length));
        setChart(buildLiveChart(needsOverride));
        setLoading(false);
        return;
      }

      const [s, n, c] = await Promise.all([api.getStats(), api.getNeeds(), api.getChartData()]);
      setStats(s);
      setNeeds(n);
      setChart(c);
      setLoading(false);
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[needsKey]);

  const safeNeeds = Array.isArray(needs) ? needs : [];
  const safeStats = stats || { totalNeeds: 0, volunteers: 0, resolved: 0, urgent: 0 };
  const safeChart = chart || { categories: [], regions: [], resolution: [] };
  const urgent = safeNeeds.filter((n) => n.priority === "urgent");
  const activeNeeds = safeNeeds.filter((n) => n.status !== "resolved");
  const predictions = predictNeeds(
    activeNeeds.map((n) => ({
      category: n.category,
      region: n.region || n.location,
      priority: n.priority,
      status: n.status,
      location: { lat: n.lat, lng: n.lng },
    }))
  );
  const predictionWarning = predictions.length > 0 && predictions[0].urgencyLevel !== 'low'
    ? `High risk of ${predictions[0].predictedNeedType} in ${predictions[0].region}`
    : null;
  
  // Calculate simple risk distribution from active needs
  const highPriority = activeNeeds.filter(n => n.priority === 'urgent').length;
  const mediumPriority = activeNeeds.filter(n => n.priority === 'medium').length;
  const lowPriority = activeNeeds.filter(n => n.priority === 'low' || !n.priority).length;
  
  const riskDistribution = [
    { name: 'High', value: highPriority, color: '#EF4444' },
    { name: 'Medium', value: mediumPriority, color: '#F59E0B' },
    { name: 'Low', value: lowPriority, color: '#10B981' },
  ];
  
  const resourceAllocation = [
    { label: 'Volunteers Active', value: safeStats.volunteers },
    { label: 'Assigned Tasks', value: activeNeeds.reduce((sum, n) => sum + Number(n.assigned || 0), 0) },
    { label: 'Open Incidents', value: activeNeeds.length },
    { label: 'Urgent Needs', value: urgent.length },
  ];

  if (loading) return <Spinner/>;

  // Quick time greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Responsive padding
  const pagePad = isMobile ? "16px 12px 48px" : isTablet ? "24px 20px 48px" : "28px 32px 48px";

  return (
    <motion.div {...fadeIn()} style={{padding: pagePad}}>
      {/* Welcome Banner */}
      <motion.div {...fadeIn(0.05)} style={{
        background:"linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
        borderRadius: isMobile ? 16 : 20, padding: isMobile ? "24px 16px" : "32px 36px", marginBottom: isMobile ? 20 : 28,
        position:"relative", overflow:"hidden"
      }}>
        {/* Decorative orbs */}
        <div style={{position:"absolute",top:"-30%",right:"5%",width:200,height:200,background:"radial-gradient(circle,rgba(37,99,235,0.25),transparent 70%)",borderRadius:"50%",filter:"blur(50px)"}}/>
        <div style={{position:"absolute",bottom:"-40%",left:"15%",width:180,height:180,background:"radial-gradient(circle,rgba(139,92,246,0.2),transparent 70%)",borderRadius:"50%",filter:"blur(40px)"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",backgroundSize:"32px 32px"}}/>

        <div style={{position:"relative",zIndex:1, display:"flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center",justifyContent:"space-between", gap: isMobile ? 20 : 0}}>
          <div style={{flex: 1}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(37,99,235,0.2)",border:"1px solid rgba(37,99,235,0.3)",borderRadius:100,padding:"5px 14px",fontSize:11.5,color:"#60A5FA",fontWeight:700,marginBottom:16}}>
              <Sparkles size={13}/> AI-Powered Intelligence
            </div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize: isMobile ? 22 : 28,color:"#fff",lineHeight:1.3,letterSpacing:"-0.02em",marginBottom:8}}>{greeting}! 👋</h2>
            <p style={{fontSize: isMobile ? 13 : 14,color:"rgba(255,255,255,0.5)",maxWidth:440}}>
              {urgent.length > 0
                ? `${urgent.length} urgent need${urgent.length>1?"s":""} require${urgent.length===1?"s":""} attention. ${activeNeeds.length} active tasks across the region.`
                : `All systems nominal. ${activeNeeds.length} active tasks being managed.`
              }
            </p>
          </div>

          {/* AI Analysis Card */}
          {!isMobile && (
            <motion.div 
              initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} transition={{delay:0.2}}
              style={{
                width: isTablet ? 260 : 320, background: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 20, 
                border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
                marginLeft: isTablet ? 20 : 40, flexShrink: 0,
              }}
            >
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
                <Brain size={16} color="#60A5FA"/>
                <span style={{fontSize:12, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"1px"}}>Strategic Insight</span>
              </div>
              <div style={{fontSize:13, color:"rgba(255,255,255,0.8)", lineHeight:1.6, marginBottom:16}}>
                {urgent.length > 0 
                  ? `Critical cluster detected in ${urgent[0].region}. Match scores for "Rescue Operations" are peaking. Recommendation: Deploy immediate response teams.`
                  : "Operational efficiency is at 94%. Optimal time to review long-term community development projects in the Mehsana region."
                }
              </div>
              <div style={{display:"flex", gap:8}}>
                 <div style={{flex:1, height:4, background:"rgba(255,255,255,0.1)", borderRadius:10, overflow:"hidden"}}>
                   <motion.div initial={{width:0}} animate={{width:"84%"}} transition={{duration:1}} style={{height:"100%", background:"#60A5FA"}}/>
                 </div>
                 <span style={{fontSize:10, color:"#60A5FA", fontWeight:800, marginTop:-4}}>84% Confidence</span>
              </div>
            </motion.div>
          )}

          <div style={{display:"flex", flexDirection: isMobile ? "row" : "column", gap:12, marginLeft: isMobile ? 0 : 30, flexShrink: 0}}>
            <button onClick={()=>onNav("upload")} aria-label="Upload data" style={{...css.btn("secondary"),background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.12)", width: isMobile ? "auto" : 160, flex: isMobile ? 1 : undefined, minHeight: 44, fontSize: isMobile ? 13 : 14}}>
              Upload Data
            </button>
            <button onClick={()=>onNav("volunteers")} aria-label="Match volunteers" style={{...css.btn("primary"), width: isMobile ? "auto" : 160, flex: isMobile ? 1 : undefined, minHeight: 44, fontSize: isMobile ? 13 : 14}}>
              Match Volunteers <ArrowRight size={16}/>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ═══ EMERGENCY MODE BANNER ═══ */}
      {emergency && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0 }}
          role="alert"
          aria-live="assertive"
          aria-label="Emergency mode active"
          style={{
            background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 40%, #B91C1C 100%)",
            borderRadius: isMobile ? 14 : 18, padding: isMobile ? "16px 14px" : "22px 28px", marginBottom: 24,
            border: "1px solid #F87171",
            boxShadow: "0 0 30px rgba(239,68,68,0.25), 0 0 80px rgba(239,68,68,0.08)",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Animated pulse ring */}
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: "absolute", top: 20, left: 24,
              width: 44, height: 44, borderRadius: "50%",
              border: "2px solid #F87171",
            }}
          />
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", position: "relative", zIndex: 1, gap: isMobile ? 16 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <ShieldAlert size={22} color="#FCA5A5" />
              </motion.div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{ width: 8, height: 8, borderRadius: "50%", background: "#F87171" }}
                  />
                  <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 800, color: "#FCA5A5", textTransform: "uppercase", letterSpacing: "1.5px" }}>EMERGENCY MODE ACTIVE</span>
                </div>
                <div style={{ fontSize: isMobile ? 12 : 14, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
                  {urgent.length > 0
                    ? `${urgent.length} critical zone${urgent.length > 1 ? 's' : ''} detected • Tasks auto-prioritized`
                    : 'All volunteers notified • Critical zones highlighted on map'
                  }
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => onNav("map")} aria-label="View emergency map" style={{
                padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: "rgba(255,255,255,0.15)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
                fontFamily: "'Inter',sans-serif",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.2s ease", minHeight: 44,
              }}>
                <Radio size={14} /> View Map
              </button>
              <button onClick={onDeactivateEmergency} aria-label="Deactivate emergency mode" style={{
                padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: "rgba(255,255,255,0.9)", color: "#991B1B",
                border: "none", cursor: "pointer",
                fontFamily: "'Inter',sans-serif",
                transition: "all 0.2s ease", minHeight: 44,
              }}>
                ✕ Deactivate
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stat Cards */}
      <motion.div {...fadeIn(0.1)} role="status" aria-live="polite" aria-label="Live statistics" style={{display:"grid",gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",gap: isMobile ? 12 : 18,marginBottom: isMobile ? 20 : 28}}>
        <StatCard label="Total Needs"      value={safeStats.totalNeeds} delta="↑ 12 this week"       accent={G.blue}  icon={<BarChart2 size={isMobile ? 20 : 24} color={G.blue}/>}/>
        <StatCard label="Active Volunteers" value={safeStats.volunteers}  delta="↑ 24 this week"       accent={G.green} icon={<Users size={isMobile ? 20 : 24} color={G.green}/>}/>
        <StatCard label="Needs Resolved"   value={safeStats.resolved}   delta="↑ 7 today"             accent={G.green} icon={<CheckCircle2 size={isMobile ? 20 : 24} color={G.green}/>}/>
        <StatCard label="Urgent Needs"     value={safeStats.urgent}     delta="↑ 3 critical" deltaColor={G.red} accent={G.red} icon={<AlertTriangle size={isMobile ? 20 : 24} color={G.red}/>}/>
      </motion.div>

      <motion.div {...fadeIn(0.12)} style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1.3fr 1fr 1fr",gap: isMobile ? 12 : 18,marginBottom: isMobile ? 20 : 24}}>
        <div style={{...css.card(),padding: isMobile ? "14px 16px" : "18px 20px",background:"linear-gradient(135deg,#0f172a,#1e293b)",border:"1px solid rgba(96,165,250,0.18)"}}>
          <div style={{fontSize:11,color:"#60A5FA",fontWeight:700,letterSpacing:"1.3px",textTransform:"uppercase",marginBottom:8}}>AI Insight</div>
          <div style={{fontSize: isMobile ? 13 : 14,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>{aiInsight || "AI is processing incoming field reports."}</div>
          <div style={{marginTop:12,fontSize:11,color:"rgba(255,255,255,0.45)"}}>Confidence: {Math.min(99, Math.round(58 + riskScore * 0.4))}%</div>
        </div>
        <div style={{...css.card(),padding: isMobile ? "14px 16px" : "18px 20px"}}>
          <div style={{fontSize:11,color:G.t3,fontWeight:700,letterSpacing:"1.3px",textTransform:"uppercase",marginBottom:8}}>Impact Score</div>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{fontSize: isMobile ? 26 : 30,fontWeight:800,color:G.green,lineHeight:1}}>
            {Math.max(65, 100 - Math.round(riskScore * 0.45))}
          </motion.div>
          <div style={{fontSize:12,color:G.t3,marginTop:8}}>Community resilience index</div>
        </div>
        <div style={{...css.card(),padding: isMobile ? "14px 16px" : "18px 20px",border: emergency ? "1px solid rgba(239,68,68,0.35)" : undefined}}>
          <div style={{fontSize:11,color:G.t3,fontWeight:700,letterSpacing:"1.3px",textTransform:"uppercase",marginBottom:8}}>Crisis Status</div>
          <div style={{fontSize: isMobile ? 18 : 22,fontWeight:800,color: emergency ? G.red : G.green}}>{emergency ? "ACTIVE" : "STABLE"}</div>
          <div style={{fontSize:12,color:G.t3,marginTop:8}}>Risk Score: {riskScore}/100</div>
        </div>
      </motion.div>

      <motion.div {...fadeIn(0.13)} style={{ ...css.card(), marginBottom: 24 }}>
        <div style={{ ...css.flex(0, 'center', 'space-between'), padding: isMobile ? '16px 14px 10px' : '20px 24px 12px', borderBottom: `1px solid ${G.border}`, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: G.t1 }}>Impact Dashboard</div>
            <div style={{ fontSize: 12, color: G.t3, marginTop: 2 }}>Live response performance and risk distribution</div>
          </div>
          <Tag type={emergency ? 'urgent' : 'active'}>{emergency ? 'Emergency' : 'Monitoring'}</Tag>
        </div>
        <div style={{ padding: isMobile ? 12 : 20, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? 'repeat(3, 1fr)' : 'repeat(3, 1fr) repeat(3, 1fr)', gap: isMobile ? 10 : 14 }}>
          {resourceAllocation.map((item) => (
            <div key={item.label} style={{ padding: isMobile ? 10 : 12, borderRadius: 12, background: '#F8FAFC', border: `1px solid ${G.borderLight}` }}>
              <div style={{ fontSize: isMobile ? 10 : 11, color: G.t3 }}>{item.label}</div>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: G.t1, marginTop: 6 }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: isMobile ? '0 12px 12px' : '0 20px 20px' }}>
          <div style={{ height: isMobile ? 200 : 240, border: `1px solid ${G.borderLight}`, borderRadius: 12, padding: 10, maxWidth: 400 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G.t2, margin: '0 0 8px 4px' }}>Risk Level Distribution</div>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={isMobile ? 35 : 45} outerRadius={isMobile ? 60 : 74}>
                  {riskDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
      {predictionWarning && (
        <motion.div {...fadeIn(0.14)} role="status" aria-live="polite" aria-label="Prediction warning" style={{...css.card(),padding: isMobile ? "12px 14px" : "14px 18px",marginBottom:20,border:"1px solid rgba(239,68,68,0.28)",background:"rgba(127,29,29,0.12)"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#FCA5A5"}}>Prediction Alert</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.84)",marginTop:6}}>{predictionWarning}</div>
        </motion.div>
      )}


      {/* Charts + Sidebar panels */}
      <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr" : "1fr 380px",gap:22,marginBottom:24}}>
        {/* Chart Card */}
        <motion.div {...fadeIn(0.15)} style={css.card()}>
          <div style={{...css.flex(0,"center","space-between"),padding: isMobile ? "16px 14px 12px" : "20px 24px 16px",borderBottom:`1px solid ${G.border}`, flexWrap: "wrap", gap: 8}}>
            <div>
              <div style={{fontSize: isMobile ? 14 : 15,fontWeight:700,color:G.t1,letterSpacing:"-0.02em"}}>Needs by Category</div>
              <div style={{fontSize:12,color:G.t3,marginTop:2}}>All regions · This month</div>
            </div>
            <div style={{...css.tag(G.blueLight,G.blue)}}><TrendingUp size={12}/> +12% vs last month</div>
          </div>
          <div style={{padding: isMobile ? 16 : 24}}>
            <div style={{height: 200, width: "100%"}}>
            <BarChart data={safeChart.categories} height="100%" />
            </div>
            <div style={{marginTop: isMobile ? 20 : 28,borderTop:`1px solid ${G.borderLight}`,paddingTop: isMobile ? 16 : 22}}>
              <div style={{fontSize:12,fontWeight:700,color:G.t2,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:16}}>Region Distribution</div>
              {safeChart.regions.map(r=><ProgressBar key={r.label} label={r.label} value={r.value} max={50}/>)}
            </div>
          </div>
        </motion.div>

        {/* Right side panels */}
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          {/* Urgent Needs */}
          <motion.div {...fadeIn(0.2)} style={css.card()}>
            <div style={{...css.flex(0,"center","space-between"),padding: isMobile ? "14px 14px 10px" : "18px 22px 14px",borderBottom:`1px solid ${G.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:G.red,boxShadow:`0 0 0 3px ${G.redLight}`}}/>
                <span style={{fontSize:14,fontWeight:700,color:G.t1}}>Urgent Needs</span>
              </div>
              <button style={css.btn("secondary",true)} onClick={()=>onNav("insights")} aria-label="View all insights">View All</button>
            </div>
            <div style={{padding: isMobile ? "6px 14px 14px" : "6px 22px 14px"}}>
              {urgent.slice(0,3).map((n,i)=>(
                <div key={n.id} style={{...css.flex(12,"flex-start"),padding:"14px 0",borderBottom:i<2?`1px solid ${G.borderLight}`:"none", flexWrap: isMobile ? "wrap" : "nowrap"}}>
                  <div style={{
                    width:36,height:36,borderRadius:10,
                    background:`linear-gradient(135deg,${G.redLight},#FEF2F2)`,
                    border:`1px solid #FECACA`,
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0
                  }}>
                    <AlertTriangle size={16} color={G.red}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:G.t1}}>{n.category}</div>
                    <div style={{fontSize:11.5,color:G.t3,display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                      <MapPin size={11}/>{n.location} · <Clock size={11}/>{n.deadline}
                    </div>
                  </div>
                  <button style={{...css.btn("primary",true),padding:"6px 14px",fontSize:12, minHeight: 36}} onClick={()=>onNav("volunteers",n.id)} aria-label={`Match volunteers for ${n.category}`}>Match</button>
                </div>
              ))}
              {urgent.length === 0 && <div style={{padding:"20px 0",textAlign:"center",color:G.t3,fontSize:13}}>✅ No urgent needs right now!</div>}
            </div>
          </motion.div>

          {/* Top Volunteers */}
          <motion.div {...fadeIn(0.25)} style={css.card()}>
            <div style={{padding: isMobile ? "14px 14px 10px" : "18px 22px 14px",borderBottom:`1px solid ${G.border}`,...css.flex(0,"center","space-between")}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15}}>🏆</span>
                <span style={{fontSize:14,fontWeight:700,color:G.t1}}>Top Volunteers</span>
              </div>
              <button style={css.btn("secondary",true)} onClick={()=>onNav("volunteers")} aria-label="See all volunteers">See All</button>
            </div>
            <div style={{padding: isMobile ? "6px 14px 14px" : "6px 22px 14px"}}>
              {[{name:"Arjun Kumar",initials:"AK",color:"#6366F1",tasks:24,pts:1240,rank:1},
                {name:"Priya Mehta",initials:"PM",color:"#EC4899",tasks:19,pts:980,rank:2},
                {name:"Sonal Raval",initials:"SR",color:"#F59E0B",tasks:17,pts:850,rank:3},
              ].map((v,i)=>(
                <div key={v.name} style={{...css.flex(12,"center"),padding:"12px 0",borderBottom:i<2?`1px solid ${G.borderLight}`:"none"}}>
                  <div style={{
                    width:24,height:24,borderRadius:8,
                    background:i===0?"linear-gradient(135deg,#F59E0B,#D97706)":i===1?"linear-gradient(135deg,#94A3B8,#64748B)":"linear-gradient(135deg,#CD7F32,#A0522D)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:11,fontWeight:800,color:"#fff"
                  }}>{v.rank}</div>
                  <Avatar initials={v.initials} color={v.color} size={36}/>
                  <div style={{flex:1, minWidth: 0}}>
                    <div style={{fontSize:13,fontWeight:600,color:G.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{v.name}</div>
                    <div style={{fontSize:11,color:G.t3}}>{v.tasks} tasks completed</div>
                  </div>
                  <div style={{textAlign:"right", flexShrink: 0}}>
                    <div style={{fontSize:14,fontWeight:800,color:G.blue}}>{v.pts.toLocaleString()}</div>
                    <div style={{fontSize:10,color:G.t3}}>points</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Full Needs Table */}
      <motion.div {...fadeIn(0.3)} style={css.card()}>
        <div style={{...css.flex(0,"center","space-between"),padding: isMobile ? "16px 14px 12px" : "20px 24px 16px",borderBottom:`1px solid ${G.border}`, flexWrap: "wrap", gap: 10}}>
          <div>
            <div style={{fontSize: isMobile ? 14 : 15,fontWeight:700,color:G.t1,letterSpacing:"-0.02em"}}>All Community Needs</div>
            <div style={{fontSize:12,color:G.t3,marginTop:2}}>Live data · {safeNeeds.length} records</div>
          </div>
          <div style={{display:"flex",gap:10, flexWrap: "wrap"}}>
            <button style={css.btn("secondary",true)} onClick={()=>onNav("tasks")} aria-label="Manage tasks">Manage Tasks</button>
            <button style={css.btn("primary",true)} onClick={()=>onNav("upload")} aria-label="Upload new data">+ Upload Data</button>
          </div>
        </div>
        <div style={{overflowX:"auto", WebkitOverflowScrolling: "touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse", minWidth: isMobile ? 700 : "auto"}}>
            <thead>
              <tr style={{background:G.bg}}>
                {["Location","Category","Region","Priority","Progress","Status",""].map(h=>(
                  <th key={h} style={{padding: isMobile ? "12px 10px" : "14px 18px",textAlign:"left",fontSize:11,fontWeight:700,color:G.t3,textTransform:"uppercase",letterSpacing:"1px",borderBottom:`1px solid ${G.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeNeeds.map(n=>(
                <tr key={n.id} style={{transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding: isMobile ? "12px 10px" : "16px 18px",fontWeight:600,color:G.t1,fontSize:13.5,borderBottom:`1px solid ${G.borderLight}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <MapPin size={14} color={G.t3}/>{n.location}
                    </div>
                  </td>
                  <td style={{padding: isMobile ? "12px 10px" : "16px 18px",color:G.t2,fontSize:13,borderBottom:`1px solid ${G.borderLight}`}}>{n.category}</td>
                  <td style={{padding: isMobile ? "12px 10px" : "16px 18px",color:G.t2,fontSize:13,borderBottom:`1px solid ${G.borderLight}`}}>{n.region}</td>
                  <td style={{padding: isMobile ? "12px 10px" : "16px 18px",borderBottom:`1px solid ${G.borderLight}`}}><Tag type={n.priority}>{n.priority.charAt(0).toUpperCase()+n.priority.slice(1)}</Tag></td>
                  <td style={{padding: isMobile ? "12px 10px" : "16px 18px",borderBottom:`1px solid ${G.borderLight}`,minWidth:130}}>
                    <div style={{fontSize:11.5,color:G.t3,marginBottom:5,fontWeight:500}}>{n.assigned}/{n.volunteers} volunteers</div>
                    <div style={{background:G.bg,borderRadius:100,height:5,overflow:"hidden"}}>
                      <div style={{width:`${n.volunteers>0?(n.assigned/n.volunteers)*100:0}%`,background:`linear-gradient(90deg,${G.blue},${G.indigo})`,height:"100%",borderRadius:100,transition:"width 0.5s ease"}}/>
                    </div>
                  </td>
                  <td style={{padding: isMobile ? "12px 10px" : "16px 18px",borderBottom:`1px solid ${G.borderLight}`}}><Tag type={n.status}>{n.status.charAt(0).toUpperCase()+n.status.slice(1)}</Tag></td>
                  <td style={{padding: isMobile ? "12px 10px" : "16px 18px",borderBottom:`1px solid ${G.borderLight}`}}>
                    {n.status!=="resolved" && <button style={{...css.btn("primary",true),padding:"6px 14px",fontSize:12, minHeight: 36}} onClick={()=>onNav("volunteers",n.id)} aria-label={`Assign volunteers for ${n.category}`}>Assign</button>}
                    {n.status==="resolved" && <span style={{fontSize:11.5,color:G.green,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><CheckCircle2 size={14}/>Done</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
