import { useState } from 'react';
import { Search, Bell, Wifi, Play, Bot, Pause, Menu } from 'lucide-react';
import { G, css } from '../styles/theme';

export default function TopBar({
  page,
  onNav,
  ngo,
  unreadCount=0,
  smartMode=false,
  onToggleSmartMode,
  realtimeSimEnabled=false,
  onToggleRealtimeSimulation,
  isMobile=false,
  isTablet=false,
  onToggleSidebar,
}) {
  const [searchFocus,setSearchFocus] = useState(false);
  const meta = {
    landing:"Welcome back to ReliefLink AI",
    dashboard:"Real-time overview · Gujarat Region · April 2026",
    insights:"AI-powered community need analysis",
    map:"Geographic need distribution & heatmap",
    upload:"Ingest community survey data",
    volunteers:"AI-powered volunteer matching engine",
    tasks:"Active & pending task management",
    reports:"Performance & impact metrics",
    notifications:"Community alerts & notifications",
  };
  const labels = {landing:"Home",dashboard:"Dashboard",insights:"Community Insights",map:"Map View",upload:"Upload Data",volunteers:"Volunteer Matching",tasks:"Tasks",reports:"Reports",notifications:"Notifications"};

  const showSearch = !isMobile;
  const showSimButton = !isMobile && !isTablet;
  const showSmartMode = !isMobile && !isTablet;

  return (
    <header style={{
      background:"rgba(255,255,255,0.8)", backdropFilter:"blur(16px) saturate(180%)",
      borderBottom:`1px solid ${G.border}`, padding: isMobile ? "0 12px" : "0 32px", height: isMobile ? 56 : 68,
      display:"flex", alignItems:"center", gap: isMobile ? 10 : 16,
      position:"sticky", top:0, zIndex:50
    }}>
      {/* Hamburger menu for mobile/tablet */}
      {(isMobile || isTablet) && (
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: "transparent", border: `1px solid ${G.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = G.bg; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <Menu size={20} color={G.t1} />
        </button>
      )}

      <div style={{ minWidth: 0 }}>
        <div style={{fontSize: isMobile ? 15 : 17,fontWeight:700,color:G.t1,letterSpacing:"-0.3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{labels[page]}</div>
        {!isMobile && <div style={{fontSize:11.5,color:G.t3,marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{meta[page]}</div>}
      </div>
      <div style={{flex:1}}/>

      {/* Live indicator */}
      <div style={{display:"flex",alignItems:"center",gap:7,background:G.greenLight,border:`1px solid #A7F3D0`,borderRadius:100,padding: isMobile ? "4px 10px" : "6px 14px", flexShrink: 0}}>
        <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:G.green,position:"relative",zIndex:1}}/>
          <div style={{position:"absolute",width:7,height:7,borderRadius:"50%",background:G.green,animation:"pulse-ring 1.5s ease-out infinite"}}/>
        </div>
        <span style={{fontSize: isMobile ? 10 : 11.5,fontWeight:700,color:G.greenDark,letterSpacing:"0.02em"}}>Live</span>
      </div>
      {realtimeSimEnabled && !isMobile && (
        <div style={{display:"flex",alignItems:"center",gap:7,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:100,padding:'6px 12px', flexShrink: 0}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:G.red}}/>
          <span style={{fontSize:11.5,fontWeight:700,color:'#B91C1C',letterSpacing:'0.02em'}}>Realtime Sim ON</span>
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <div style={{
          display:"flex",alignItems:"center",gap:8,
          background: searchFocus ? "#fff" : G.bg,
          border:`1px solid ${searchFocus ? G.blue : G.border}`,
          borderRadius:12, padding:"9px 16px", minWidth: isTablet ? 180 : 240, maxWidth: 320,
          transition:"all 0.25s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: searchFocus ? `0 0 0 4px ${G.blue}14, ${G.shadowMd}` : "none",
          flex: isTablet ? "0 1 200px" : "0 1 280px",
        }}>
          <Search size={15} color={G.t3} strokeWidth={2.2}/>
          <input placeholder="Search needs, volunteers…"
            onFocus={()=>setSearchFocus(true)} onBlur={()=>setSearchFocus(false)}
            style={{border:"none",background:"transparent",outline:"none",fontFamily:"'Inter',sans-serif",fontSize:13,color:G.t1,width:"100%"}}/>
        </div>
      )}
      
      {/* Simulation Button */}
      {showSimButton && (
        <button 
          onClick={onToggleRealtimeSimulation}
          style={{
            minWidth: 122, height: 40, borderRadius: 12, background: realtimeSimEnabled ? '#FEF2F2' : G.amberLight,
            border: realtimeSimEnabled ? '1px solid #FCA5A5' : `1px solid #FDE68A`, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.2s ease",
            opacity: 1, gap: 6, padding: '0 10px', fontSize: 11.5, fontWeight: 700,
            color: realtimeSimEnabled ? '#B91C1C' : G.amberDark, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = realtimeSimEnabled ? "#FEE2E2" : "#FEF3C7"; e.currentTarget.style.boxShadow = `0 0 0 3px #FEF3C788` }}
          onMouseLeave={e => { e.currentTarget.style.background = realtimeSimEnabled ? '#FEF2F2' : G.amberLight; e.currentTarget.style.boxShadow = "none" }}
        >
          {realtimeSimEnabled ? <Pause size={15} color="#B91C1C" /> : <Play size={15} color={G.amberDark} fill={G.amberDark} />}
          {realtimeSimEnabled ? 'Stop Sim' : 'Start Sim'}
        </button>
      )}

      {/* Smart Mode Toggle */}
      {showSmartMode && (
        <button
          onClick={onToggleSmartMode}
          style={{
            display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:12,cursor:'pointer',
            border:`1px solid ${smartMode ? '#A7F3D0' : G.border}`,
            background: smartMode ? 'linear-gradient(135deg,#ECFDF5,#D1FAE5)' : G.bg,
            color: smartMode ? G.greenDark : G.t2,
            fontSize:12,fontWeight:700, flexShrink: 0,
          }}
        >
          <Bot size={14}/>
          {smartMode ? 'Smart Mode ON' : 'Smart Mode OFF'}
        </button>
      )}

      {/* Notifications */}
      <div onClick={()=>onNav("notifications")}
        style={{
          width:40,height:40,borderRadius:12,background:G.bg,
          border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",position:"relative",transition:"all 0.2s ease", flexShrink: 0,
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=G.blueLight;e.currentTarget.style.borderColor=G.blue;e.currentTarget.style.boxShadow=`0 0 0 3px ${G.blue}14`}}
        onMouseLeave={e=>{e.currentTarget.style.background=G.bg;e.currentTarget.style.borderColor=G.border;e.currentTarget.style.boxShadow="none"}}
      >
        <Bell size={18} color={G.t2} strokeWidth={2}/>
        {unreadCount > 0 && (
          <div style={{
            position:"absolute",top:6,right:6,width:9,height:9,borderRadius:"50%",
            background:"linear-gradient(135deg,#EF4444,#DC2626)",
            border:`2px solid #fff`,boxShadow:"0 2px 4px rgba(239,68,68,0.4)"
          }}/>
        )}
      </div>

      {/* Avatar */}
      {!isMobile && (
        <div style={{
          width:38,height:38,borderRadius:12,
          background:"linear-gradient(135deg,#6366F1,#8B5CF6)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:12,fontWeight:800,color:"#fff",cursor:"pointer",
          boxShadow:"0 4px 12px rgba(99,102,241,0.25)",
          transition:"all 0.2s ease", flexShrink: 0,
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.08)";e.currentTarget.style.boxShadow="0 6px 16px rgba(99,102,241,0.35)"}}
          onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 12px rgba(99,102,241,0.25)"}}
        >
          {ngo ? ngo.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "NG"}
        </div>
      )}
    </header>
  );
}
