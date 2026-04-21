import { useState } from 'react';
import { G, css } from '../styles/theme';
import { api } from '../api';
import { MapPin, Navigation } from 'lucide-react';
import { validateVolunteer } from '../utils/validation';
import { haversineKm } from '../utils/geo';
import { useMediaQuery } from '../hooks/useMediaQuery';

const SKILL_OPTIONS = ["Water Logistics","Medical & First Aid","Civil Engineer","Logistics & Transport","Social Worker","Water Engineer","Teaching & Education","Medical Doctor","Food Distribution","Sanitation Expert","Community Organizer"];
const AVATAR_COLORS = ["#6366F1","#EC4899","#F59E0B","#16A34A","#0891B2","#7C3AED","#DB2777","#059669","#D97706","#2563EB"];
const REGION_OPTIONS = ["Mehsana","Patan","Banaskantha","Sabarkantha","Gandhinagar","Ahmedabad","Anand"];

// Default center coordinates per region (for auto-filling lat/lng)
const REGION_COORDS = {
  "Mehsana":     { lat: 23.59, lng: 72.38 },
  "Patan":       { lat: 23.85, lng: 72.13 },
  "Banaskantha": { lat: 24.17, lng: 72.43 },
  "Sabarkantha": { lat: 23.63, lng: 73.00 },
  "Gandhinagar": { lat: 23.22, lng: 72.64 },
  "Ahmedabad":   { lat: 23.02, lng: 72.57 },
  "Anand":       { lat: 22.56, lng: 72.95 },
};

export { SKILL_OPTIONS, AVATAR_COLORS, REGION_OPTIONS, REGION_COORDS };

export default function AddVolunteerModal({onClose, onSave, taskLocation}) {
  const defaultRegion = REGION_OPTIONS[0];
  const defaultCoords = REGION_COORDS[defaultRegion];

  const [form, setForm] = useState({
    name:"", skill:SKILL_OPTIONS[0], region:defaultRegion,
    lat: String(defaultCoords.lat), lng: String(defaultCoords.lng),
    phone:"", available:true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const { isMobile } = useMediaQuery();

  const handleRegionChange = (region) => {
    const coords = REGION_COORDS[region] || defaultCoords;
    // Add a small random offset so volunteers aren't all at the exact same point
    const jitterLat = (Math.random() - 0.5) * 0.08;
    const jitterLng = (Math.random() - 0.5) * 0.08;
    setForm(f => ({
      ...f,
      region,
      lat: (coords.lat + jitterLat).toFixed(4),
      lng: (coords.lng + jitterLng).toFixed(4)
    }));
  };

  const handleSave = async () => {
    if(!form.name.trim()) { setError("Name is required"); return; }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if(isNaN(lat) || isNaN(lng)) { setError("Enter valid coordinates"); return; }

    setSaving(true);
    try {
      const currentVols = await api.getVolunteers();
      const newId = Math.max(...currentVols.map(v=>v.id), 0) + 1;
      const initials = form.name.trim().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      const color = AVATAR_COLORS[currentVols.length % AVATAR_COLORS.length];

      // Auto-calculate distance from volunteer to the selected task (or region center)
      const taskLat = taskLocation?.lat || 23.58;
      const taskLng = taskLocation?.lng || 72.37;
      const distance = Math.round(haversineKm(lat, lng, taskLat, taskLng) * 10) / 10;

      const newVol = {
        id: newId, name: form.name.trim(), initials, skill: form.skill, region: form.region,
        distance, rating: 4, tasks: 0, points: 0,
        match: Math.floor(50+Math.random()*40), available: form.available, color,
        phone: form.phone, lat, lng,
      };
      const email = localStorage.getItem('ReliefLink_current_ngo_email');
      // Validate and sanitize to prevent malformed records and unsafe rendered content.
      const validation = validateVolunteer(newVol, { ngoEmail: email });
      if (!validation.isValid) {
        setError(Object.values(validation.errors)[0] || "Please correct invalid fields.");
        return;
      }
      await api.addVolunteer(validation.sanitizedData);
      onSave(validation.sanitizedData);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to save volunteer");
    } finally {
      setSaving(false);
    }
  };

  // Computed preview distance
  const previewLat = parseFloat(form.lat);
  const previewLng = parseFloat(form.lng);
  const taskLat = taskLocation?.lat || 23.58;
  const taskLng = taskLocation?.lng || 72.37;
  const previewDist = (!isNaN(previewLat) && !isNaN(previewLng))
    ? (Math.round(haversineKm(previewLat, previewLng, taskLat, taskLng) * 10) / 10)
    : null;

  const inp = {width:"100%",padding:"10px 12px",border:`1.5px solid ${G.border}`,borderRadius:10,fontSize:13,fontFamily:"'Inter',sans-serif",color:G.t1,outline:"none",background:G.surface,boxSizing:"border-box",transition:"all 0.2s"};
  const lbl = {fontSize:11,fontWeight:700,color:G.t2,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.8px"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{...css.card(),width: isMobile ? '100%' : 480, maxHeight: isMobile ? '100vh' : 'auto', height: isMobile ? '100vh' : 'auto', padding:0,boxShadow:G.shadowXl,animation:"slideUp 0.25s cubic-bezier(0.16,1,0.3,1)", borderRadius: isMobile ? 0 : undefined, overflowY: 'auto'}}>
        <style>{`@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        {/* Header */}
        <div style={{padding:"22px 26px 18px",borderBottom:`1px solid ${G.border}`,...css.flex(0,"center","space-between")}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:G.t1,letterSpacing:"-0.02em"}}>Add New Volunteer</div>
            <div style={{fontSize:12,color:G.t3,marginTop:3}}>Location-based distance is auto-calculated</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:G.t3,cursor:"pointer",lineHeight:1,padding:4}}>×</button>
        </div>

        {/* Form */}
        <div style={{padding:"22px 26px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Name */}
          <div>
            <label style={lbl}>Full Name *</label>
            <input style={inp} placeholder="e.g. Arjun Kumar" value={form.name} onChange={e=>set("name",e.target.value)}
              onFocus={e=>{e.target.style.borderColor=G.blue;e.target.style.boxShadow=`0 0 0 3px ${G.blue}12`}}
              onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}}/>
          </div>

          {/* Skill */}
          <div>
            <label style={lbl}>Skill / Expertise *</label>
            <select style={{...inp,cursor:"pointer"}} value={form.skill} onChange={e=>set("skill",e.target.value)}>
              {SKILL_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Region + Phone */}
          <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap:14}}>
            <div>
              <label style={lbl}>Region *</label>
              <select style={{...inp,cursor:"pointer"}} value={form.region} onChange={e=>handleRegionChange(e.target.value)}>
                {REGION_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Phone Number</label>
              <input style={inp} placeholder="e.g. 9876543210" value={form.phone} onChange={e=>set("phone",e.target.value)}
                onFocus={e=>{e.target.style.borderColor=G.blue;e.target.style.boxShadow=`0 0 0 3px ${G.blue}12`}}
                onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}}/>
            </div>
          </div>

          {/* Coordinates */}
          <div>
            <label style={lbl}><MapPin size={11} style={{display:"inline",verticalAlign:"-1px"}}/> Volunteer Location (auto-filled from region)</label>
            <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap:14}}>
              <input style={inp} placeholder="Latitude" type="number" step="0.0001" value={form.lat} onChange={e=>set("lat",e.target.value)}
                onFocus={e=>{e.target.style.borderColor=G.blue;e.target.style.boxShadow=`0 0 0 3px ${G.blue}12`}}
                onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}}/>
              <input style={inp} placeholder="Longitude" type="number" step="0.0001" value={form.lng} onChange={e=>set("lng",e.target.value)}
                onFocus={e=>{e.target.style.borderColor=G.blue;e.target.style.boxShadow=`0 0 0 3px ${G.blue}12`}}
                onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none"}}/>
            </div>
          </div>

          {/* Live Distance Preview */}
          {previewDist !== null && (
            <div style={{
              display:"flex",alignItems:"center",gap:10,
              padding:"12px 16px",background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",
              border:"1px solid #BFDBFE",borderRadius:12
            }}>
              <Navigation size={18} color={G.blue}/>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:G.blue,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px"}}>Auto-Calculated Distance</div>
                <div style={{fontSize:16,fontWeight:800,color:G.t1,marginTop:2}}>{previewDist} km <span style={{fontSize:12,fontWeight:500,color:G.t3}}>from selected task</span></div>
              </div>
            </div>
          )}

          {/* Available toggle */}
          <div style={{...css.flex(12,"center"),padding:"12px 16px",background:G.bg,borderRadius:10,border:`1px solid ${G.border}`}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:G.t1}}>Available for tasks</div>
              <div style={{fontSize:11.5,color:G.t3}}>Ready to be assigned immediately</div>
            </div>
            <div onClick={()=>set("available",!form.available)} style={{width:44,height:24,borderRadius:100,background:form.available?G.green:G.border,cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:form.available?22:3,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </div>
          </div>

          {/* Error */}
          {error && <div style={{fontSize:12,color:G.red,background:G.redLight,border:`1px solid #FECACA`,borderRadius:10,padding:"10px 14px"}}>⚠️ {error}</div>}
        </div>

        {/* Footer */}
        <div style={{padding:"16px 26px",borderTop:`1px solid ${G.border}`,...css.flex(10,"center","flex-end")}}>
          <button onClick={onClose} style={css.btn("secondary",true)}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{...css.btn("primary"),opacity:saving?0.7:1}}>
            {saving ? "Saving…" : "Add Volunteer"}
          </button>
        </div>
      </div>
    </div>
  );
}
