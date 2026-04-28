import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { G, css } from '../styles/theme';
import { api, getPreciseTravelTime } from '../api';
import { backendApi } from '../services/backendApi';
import Spinner from '../components/Spinner';
import AddVolunteerModal from '../components/AddVolunteerModal';
import VolunteerCard from '../components/volunteers/VolunteerCard';
import { Sparkles, Zap, UserPlus } from 'lucide-react';
import { rankVolunteersForTask } from "../core";
import { resolveNeedCoordinates } from '../data/gujaratPlaces';
import { useMediaQuery } from '../hooks/useMediaQuery';

const fadeIn = (delay=0) => ({initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:0.5,delay,ease:[0.16,1,0.3,1]}});
const DEFAULT_TASK_POINT = { lat: 23.58, lng: 72.37 };

function getNeedLocationPoint(need) {
  if (!need) return DEFAULT_TASK_POINT;
  const lat = Number(need.lat);
  const lng = Number(need.lng);
  // Reject (0,0) = Null Island — always indicates missing data in this Gujarat-based app
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return { lat, lng };
  const resolved = resolveNeedCoordinates(need);
  return (Number.isFinite(resolved?.lat) && Number.isFinite(resolved?.lng)) ? resolved : DEFAULT_TASK_POINT;
}

export default function Volunteers({ initialTask, needsOverride = null, intelligence = null, smartMode = false }) {
  const [vols,setVols] = useState(null);
  const [needs,setNeeds] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selectedNeedId, setSelectedNeedId] = useState("");
  const [filter,setFilter] = useState("all");
  const [assigning,setAssigning] = useState({});
  const [assigned,setAssigned] = useState({});
  const [assignSuccess, setAssignSuccess] = useState({});
  const [showModal,setShowModal] = useState(false);
  const [travelTimes, setTravelTimes] = useState({});
  const [expanded, setExpanded] = useState({});
  const [smartRank, setSmartRank] = useState([]);
  const [pendingSmartAssign, setPendingSmartAssign] = useState(false);
  const [aiExplanations, setAiExplanations] = useState({}); // { volunteerId: explanation }
  const [explanationsLoading, setExplanationsLoading] = useState(false);
  const travelCacheRef = useRef(new Map());
  const { isMobile, isTablet } = useMediaQuery();

  useEffect(()=>{ 
    const applySelection = (active) => {
      if (initialTask && typeof initialTask === "object") {
        if (initialTask.needId != null || initialTask.id != null) {
          setSelectedNeedId(String(initialTask.needId ?? initialTask.id));
        } else if (initialTask.smartAssign) {
          const urgent = active.find((n) => n.priority === "urgent");
          setSelectedNeedId(String((urgent || active[0])?.id || ""));
          setPendingSmartAssign(true);
        } else if (active.length > 0) {
          setSelectedNeedId(String(active[0].id));
        } else {
          setSelectedNeedId("");
        }
      } else if (initialTask != null && initialTask !== "") {
        setSelectedNeedId(String(initialTask));
      } else if(active.length > 0) {
        setSelectedNeedId(String(active[0].id));
      } else {
        setSelectedNeedId("");
      }
    };

    if (Array.isArray(needsOverride) && needsOverride.length > 0) {
      api.getVolunteers()
        .then((volunteers) => {
          const active = needsOverride.filter((n) => n.status !== "resolved");
          setVols(volunteers);
          setNeeds(active);
          applySelection(active);
          setLoadError('');
        })
        .catch((error) => {
          console.error(error);
          setVols([]);
          setNeeds([]);
          setLoadError(error?.message || 'Failed to load volunteers/incidents.');
        });
      return;
    }

    Promise.all([api.getVolunteers(), api.getNeeds()])
      .then(([volunteers, nList]) => {
        setVols(volunteers);
        const active = nList.filter(n => n.status !== "resolved");
        setNeeds(active);
        applySelection(active);
        setLoadError('');
      })
      .catch((error) => {
        console.error(error);
        setVols([]);
        setNeeds([]);
        setLoadError(error?.message || 'Failed to load volunteers/incidents.');
      });
  },[initialTask, needsOverride]);

  useEffect(() => {
    if (!vols || !selectedNeedId || needs.length === 0) return;
    const targetNeed = needs.find(n => String(n.id) === selectedNeedId);
    const targetLocation = targetNeed ? getNeedLocationPoint(targetNeed) : null;
    if (!targetLocation) return;

    const requestable = vols.filter((v) => v.lat && v.lng);
    const pending = requestable.filter((v) => {
      const cacheKey = `${selectedNeedId}:${v.id}`;
      if (travelCacheRef.current.has(cacheKey)) return false;
      if (travelTimes[v.id]) return false;
      return true;
    });
    if (!pending.length) return;

    let active = true;
    Promise.allSettled(
      pending.map((v) =>
        getPreciseTravelTime({ lat: v.lat, lng: v.lng }, targetLocation).then((timeData) => ({
          id: v.id,
          cacheKey: `${selectedNeedId}:${v.id}`,
          timeData,
        }))
      )
    ).then((results) => {
      if (!active) return;
      const next = {};
      results.forEach((entry) => {
        if (entry.status !== 'fulfilled') return;
        const { id, cacheKey, timeData } = entry.value;
        travelCacheRef.current.set(cacheKey, timeData);
        next[id] = timeData;
      });
      if (Object.keys(next).length) {
        setTravelTimes((prev) => ({ ...prev, ...next }));
      }
    });

    return () => {
      active = false;
    };
  }, [selectedNeedId, vols, needs]);

  useEffect(() => {
    if (!vols?.length) {
      setSmartRank([]);
      return;
    }
    if (!selectedNeedId) {
      setSmartRank([...vols]);
      return;
    }
    const task = needs.find((n) => String(n.id) === String(selectedNeedId));
    if (!task) {
      setSmartRank([...vols]);
      return;
    }
    const taskWithLocation = { ...task, location: getNeedLocationPoint(task) };
    const { ranked } = rankVolunteersForTask(taskWithLocation, vols);
    setSmartRank(ranked);
  }, [vols, needs, selectedNeedId]);

  // ── Fetch AI explanations for top matches ────────────────────────────
  // When a task is selected and volunteers are ranked, call the backend
  // explain-match endpoint for the top 5 candidates (Claude → Gemini fallback).
  useEffect(() => {
    if (!smartRank.length || !selectedNeedId) return;

    const task = needs.find((n) => String(n.id) === String(selectedNeedId));
    if (!task) return;

    const topCandidates = smartRank.slice(0, 5);
    const missingExplanations = topCandidates.filter(
      (v) => !aiExplanations[v.id] && v.aiMatchReasons !== undefined
    );

    if (missingExplanations.length === 0) return;

    let cancelled = false;
    setExplanationsLoading(true);

    Promise.allSettled(
      missingExplanations.map((vol) =>
        backendApi
          .explainMatch(vol, task)
          .then((result) => ({ id: vol.id, explanation: result.explanation, provider: result.provider }))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const newExplanations = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          newExplanations[r.value.id] = r.value.explanation;
        }
      });
      if (Object.keys(newExplanations).length) {
        setAiExplanations((prev) => ({ ...prev, ...newExplanations }));
      }
      setExplanationsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [smartRank, selectedNeedId, needs]);

  const handleAssign = async (id) => {
    if (!selectedNeedId) return;
    setAssignSuccess((prev) => ({ ...prev, [id]: false }));
    setAssigning(a=>({...a,[id]:true}));
    const aiProcessingDelayMs = 1000 + Math.floor(Math.random() * 1000);
    await new Promise((resolve) => setTimeout(resolve, aiProcessingDelayMs));
    const res = await api.assignVolunteer(id, parseInt(selectedNeedId));
    setAssigning(a=>({...a,[id]:false}));
    if(res.success) {
      setAssigned(a=>({...a,[id]:true}));
      setAssignSuccess((prev) => ({ ...prev, [id]: true }));
      setVols(v => v.map(vol => vol.id === id ? { ...vol, available: false, tasks: vol.tasks + 1 } : vol));
      setNeeds(curr => curr.map(n => String(n.id) === selectedNeedId ? { ...n, assigned: Math.min(n.assigned + 1, n.volunteers) } : n));
      setTimeout(() => {
        setAssignSuccess((prev) => ({ ...prev, [id]: false }));
      }, 2500);
    }
  };

  const handleVolunteerAdded = (newVol) => { setVols(v=>[...v, newVol]); setShowModal(false); };

  const handleAutoAssign = async () => {
    if (!selectedNeedId) return;
    const targetNeed = needs.find(n => String(n.id) === String(selectedNeedId));
    if (!targetNeed) return;
    let needed = targetNeed.volunteers - targetNeed.assigned;
    if (needed <= 0) { alert("Task is already fully assigned."); return; }
    const targetNeedWithLocation = { ...targetNeed, location: getNeedLocationPoint(targetNeed) };
    const { ranked } = rankVolunteersForTask(targetNeedWithLocation, vols);
    const sorted = ranked.filter(v => v.available);
    const toAssign = sorted.slice(0, needed);
    if (toAssign.length === 0) { alert("No available volunteers at the moment."); return; }
    for (const v of toAssign) {
      setAssigning(a=>({...a,[v.id]:true}));
      await api.assignVolunteer(v.id, targetNeed.id);
      setAssigning(a=>({...a,[v.id]:false}));
      setAssigned(a=>({...a,[v.id]:true}));
    }
    setVols(curr => curr.map(vol => toAssign.find(t=>t.id===vol.id) ? { ...vol, available: false, tasks: vol.tasks + 1 } : vol));
    setNeeds(curr => curr.map(n => n.id === targetNeed.id ? { ...n, assigned: n.assigned + toAssign.length } : n));
    alert(`SmartAssign completed: ${toAssign.length} volunteers deployed by AI ranking.`);
  };

  useEffect(() => {
    if (!pendingSmartAssign || !selectedNeedId || !vols?.length || !needs?.length) return;
    setPendingSmartAssign(false);
    handleAutoAssign();
  }, [pendingSmartAssign, selectedNeedId, vols, needs]);

  if(!vols) return <Spinner/>;
  const filtered = filter==="all" ? smartRank : filter==="available" ? smartRank.filter(v=>v.available) : smartRank;
  const selectedNeed = needs.find((n) => String(n.id) === selectedNeedId);
  const selectedRecommendation = intelligence?.recommendations?.find((item) => String(item.taskId) === String(selectedNeedId));

  return (
    <motion.div {...fadeIn()} style={{padding: isMobile ? "16px 12px 48px" : "28px 32px 48px"}}>
      {loadError && (
        <div style={{marginBottom:16,padding:'10px 12px',borderRadius:10,border:'1px solid #FCA5A5',background:'#FEF2F2',color:'#B91C1C',fontSize:12}}>
          {loadError}
        </div>
      )}
      {showModal && (() => {
        const targetNeed = needs.find(n => String(n.id) === selectedNeedId);
        const taskLoc = targetNeed ? getNeedLocationPoint(targetNeed) : DEFAULT_TASK_POINT;
        return <AddVolunteerModal onClose={()=>setShowModal(false)} onSave={handleVolunteerAdded} taskLocation={taskLoc}/>;
      })()}
      
      {/* Header */}
      <div style={{display:"flex",flexDirection: isMobile ? "column" : "row",alignItems: isMobile ? "flex-start" : "center",justifyContent:"space-between",marginBottom:24, gap: isMobile ? 16 : 0}}>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#ECFDF5,#D1FAE5)",border:"1px solid #A7F3D0",borderRadius:100,padding:"5px 14px",fontSize:11.5,color:G.green,fontWeight:700,marginBottom:12}}>
            <Sparkles size={13}/> AI-Powered Matching
          </div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize: isMobile ? 20 : 24,color:G.t1,margin:0,letterSpacing:"-0.02em"}}>Volunteer Matching Engine</h2>
        </div>
        <div style={{display:"flex",gap:10, flexWrap:"wrap"}}>
          {["all","available"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              aria-label={`Filter ${f} volunteers`}
              style={{
                padding:"8px 18px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",
                border:`1.5px solid ${filter===f?G.blue:"transparent"}`,
                background:filter===f?G.blueLight:G.surface,color:filter===f?G.blue:G.t2,
                transition:"all 0.2s ease",boxShadow:filter===f?`0 0 0 3px ${G.blue}10`:G.shadow,
                minHeight: 44,
              }}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
          <button style={{...css.btn("primary",true),display:"flex",alignItems:"center",gap:6, minHeight: 44}} onClick={()=>setShowModal(true)} aria-label="Add new volunteer">
            <UserPlus size={15}/> Add Volunteer
          </button>
        </div>
      </div>

      {/* Task Assignment Banner */}
      <motion.div {...fadeIn(0.05)} style={{
        background:"linear-gradient(135deg, #0F172A, #1E293B)",
        borderRadius: isMobile ? 14 : 18,padding: isMobile ? "16px 14px" : "24px 28px",marginBottom:28,
        display:"flex",flexDirection: isMobile ? "column" : "row",alignItems: isMobile ? "flex-start" : "center",justifyContent:"space-between",
        position:"relative",overflow:"hidden", gap: isMobile ? 16 : 0
      }}>
        <div style={{position:"absolute",top:"-50%",right:"10%",width:200,height:200,background:"radial-gradient(circle,rgba(37,99,235,0.15),transparent 70%)",borderRadius:"50%",filter:"blur(40px)"}}/>
        
        <div style={{flex:1,position:"relative",zIndex:1}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:8}}>Select Target Task for Assignment</div>
          <select
            value={selectedNeedId}
            onChange={e => setSelectedNeedId(e.target.value)}
            aria-label="Select target task for volunteer assignment"
            style={{
              width:"100%",maxWidth:520,padding:"12px 16px",borderRadius:12,
              border:"1px solid rgba(255,255,255,0.12)",outline:"none",fontSize:14,
              fontWeight:600,color:"#fff",background:"rgba(255,255,255,0.08)",
              cursor:"pointer",fontFamily:"'Inter',sans-serif",backdropFilter:"blur(8px)"
            }}
          >
            {needs.length === 0 && <option value="">No active tasks available</option>}
            {needs.map(n => (
              <option key={n.id} value={n.id} style={{color:"#0F172A",background:"#fff"}}>{n.category} — {n.location} ({n.assigned}/{n.volunteers} assigned)</option>
            ))}
          </select>
        </div>
        <div style={{marginLeft: isMobile ? 0 : 24,position:"relative",zIndex:1, width: isMobile ? "100%" : "auto"}}>
          <button onClick={handleAutoAssign} disabled={!selectedNeedId || !smartMode}
            aria-label="Auto-assign best matching volunteer"
            style={{
              ...css.btn("primary"),
              background:"linear-gradient(135deg,#10B981,#059669)",
              boxShadow:"0 8px 20px rgba(16,185,129,0.3)",
              opacity:selectedNeedId && smartMode ?1:0.5,display:"flex",alignItems:"center",gap:8
            }}>
            <Zap size={16}/> {smartMode ? 'Auto-Assign Best Match' : 'Enable Smart Mode'}
          </button>
        </div>
      </motion.div>

      {selectedRecommendation && (
        <motion.div {...fadeIn(0.08)} style={{...css.card(),padding:'14px 16px',marginBottom:16,border:'1px solid #BFDBFE',background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)'}}>
          <div style={{fontSize:12,fontWeight:700,color:G.blue,marginBottom:6}}>Volunteer Insights Panel · AI Recommended</div>
          <div style={{fontSize:12.5,color:G.t1,fontWeight:600}}>
            Best candidate: {selectedRecommendation.rankedVolunteers?.[0]?.name || 'No match yet'}
          </div>
          <div style={{fontSize:12,color:G.t2,marginTop:4}}>
            {selectedRecommendation.rankedVolunteers?.[0]?.explanation?.[0] || 'Waiting for recommendation details.'}
          </div>
        </motion.div>
      )}

      {/* Volunteer Cards Grid */}
      <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,1fr)" : "repeat(3,1fr)",gap: isMobile ? 14 : 20}}>
        {filtered.map((v, i) => (
          <VolunteerCard
            key={v.id}
            volunteer={v}
            index={i}
            selectedNeed={selectedNeed}
            travelTime={travelTimes[v.id]}
            expanded={!!expanded[v.id]}
            onToggleExpand={() => setExpanded((prev) => ({ ...prev, [v.id]: !prev[v.id] }))}
            assigning={!!assigning[v.id]}
            assigned={!!assigned[v.id]}
            assignSuccess={!!assignSuccess[v.id]}
            onAssign={handleAssign}
            aiExplanation={aiExplanations[v.id]}
            aiExplanationLoading={explanationsLoading && !aiExplanations[v.id]}
            G={G}
            css={css}
            fadeIn={fadeIn}
          />
        ))}
      </div>
    </motion.div>
  );
}
