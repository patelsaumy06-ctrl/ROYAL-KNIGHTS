import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap, User, Building } from 'lucide-react';
import { loginUser, registerUser } from '../services/authService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useMediaQuery } from '../hooks/useMediaQuery';

// NGO types list (no longer imported from api.js)
export const NGO_TYPES = [
  "Relief NGO","Health NGO","Disaster Relief","Education NGO",
  "Water & Sanitation","Food Security","Community Development","Super Admin"
];

// Demo accounts for the quick-fill UI panel (passwords NOT stored — just for display hints)
const DEMO_HINTS = [
  { email: "ngo@ReliefLink.org",   password: "ngo123",   type: "Relief NGO"      },
  { email: "care@gujarat.org",     password: "care123",  type: "Health NGO"      },
  { email: "flood@aid.org",        password: "flood123", type: "Disaster Relief" },
];

// Map Firebase error codes to friendly messages
function friendlyError(code) {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// ─── SIGN IN ─────────────────────────────────────────────────────────────────
function SignIn({ onLogin, onGoSignUp }) {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [focusField, setFocusField] = useState(null);
  const { isMobile, isTablet }    = useMediaQuery();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginUser(email.trim().toLowerCase(), password);
      const user   = result.user;

      // Fetch NGO profile from Firestore to get name/type
      const snap = await getDoc(doc(db, "ngos", user.email));
      const profile = snap.exists() ? snap.data() : {};

      onLogin({
        email: user.email,
        name:  profile.name  || user.email,
        type:  profile.type  || "Relief NGO",
      });
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const showBrandPanel = !isMobile;

  return (
    <div style={{minHeight:"100vh",width:"100vw",display:"flex",flexDirection:isMobile?"column":"row",fontFamily:"'Inter',sans-serif",overflow:"hidden"}}>

      {/* ── Brand Panel ── */}
      {showBrandPanel && (
        <div style={{
          flex:isTablet?"0 0 38%":"0 0 45%",
          background:"linear-gradient(160deg,#0B1120 0%,#0F172A 50%,#1E293B 100%)",
          display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",
          padding:isTablet?36:60,position:"relative",overflow:"hidden"
        }}>
          <div style={{position:"absolute",top:"10%",left:"-10%",width:"60%",height:"60%",background:"radial-gradient(circle,rgba(37,99,235,0.2),transparent 70%)",borderRadius:"50%",filter:"blur(80px)"}}/>
          <div style={{position:"absolute",bottom:"5%",right:"-15%",width:"50%",height:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.15),transparent 70%)",borderRadius:"50%",filter:"blur(60px)"}}/>
          <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",backgroundSize:"48px 48px"}}/>

          <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.8}}
            style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:420}}>
            <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#2563EB,#8B5CF6)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:32,fontSize:34,boxShadow:"0 20px 40px rgba(37,99,235,0.3),inset 0 1px 0 rgba(255,255,255,0.2)"}}>🤝</div>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:isTablet?36:44,color:"#fff",lineHeight:1.15,letterSpacing:"-0.03em",marginBottom:20}}>
              ReliefLink <span style={{background:"linear-gradient(135deg,#60A5FA,#A78BFA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AI</span>
            </h1>
            <p style={{fontSize:isTablet?14:16,color:"rgba(255,255,255,0.5)",lineHeight:1.7,marginBottom:40}}>
              Transform scattered community data into coordinated, life-saving action with AI-powered intelligence.
            </p>
            <div style={{display:"flex",gap:isTablet?20:32,justifyContent:"center"}}>
              {[["1,240+","Volunteers"],["89%","Resolution"],["28","Districts"]].map(([n,l])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:isTablet?22:26,fontWeight:800,color:"#fff",letterSpacing:"-0.03em"}}>{n}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"1.5px",marginTop:4}}>{l}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Form Panel ── */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#FAFCFF",padding:isMobile?"40px 20px":40,position:"relative",minHeight:isMobile?"100vh":"auto"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle,#E2E8F0 1px,transparent 1px)",backgroundSize:"24px 24px",opacity:0.5}}/>

        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.6,delay:0.2}}
          style={{width:"100%",maxWidth:420,position:"relative",zIndex:1}}>

          {isMobile && (
            <div style={{textAlign:"center",marginBottom:32}}>
              <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#2563EB,#8B5CF6)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16,fontSize:28,boxShadow:"0 12px 28px rgba(37,99,235,0.3)"}}>🤝</div>
              <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:"#0F172A",lineHeight:1.15,letterSpacing:"-0.03em",marginBottom:8}}>
                ReliefLink <span style={{background:"linear-gradient(135deg,#2563EB,#8B5CF6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AI</span>
              </h1>
            </div>
          )}

          <div style={{marginBottom:36}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EFF6FF",border:"1px solid #DBEAFE",borderRadius:100,padding:"6px 14px",fontSize:12,color:"#2563EB",fontWeight:700,marginBottom:20}}>
              <Zap size={13} fill="#2563EB"/> Secure Portal
            </div>
            <h2 style={{fontSize:isMobile?24:28,fontWeight:800,color:"#0F172A",letterSpacing:"-0.03em",marginBottom:8}}>Welcome back</h2>
            <p style={{fontSize:14.5,color:"#64748B"}}>Sign in to your NGO dashboard</p>
          </div>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{marginBottom:20}}>
              <label style={{fontSize:13,fontWeight:600,color:"#334155",display:"block",marginBottom:8}}>Email Address</label>
              <div style={{position:"relative"}}>
                <Mail size={17} color={focusField==="email"?"#2563EB":"#94A3B8"} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@ngo.org" required
                  onFocus={()=>setFocusField("email")} onBlur={()=>setFocusField(null)}
                  style={{width:"100%",padding:"13px 14px 13px 44px",border:`1.5px solid ${error?"#FECACA":focusField==="email"?"#2563EB":"#E2E8F0"}`,borderRadius:12,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",transition:"all 0.2s",background:error?"#FEF2F2":"#fff",boxShadow:focusField==="email"?"0 0 0 4px rgba(37,99,235,0.08)":"",minHeight:48}}/>
              </div>
            </div>

            {/* Password */}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:13,fontWeight:600,color:"#334155",display:"block",marginBottom:8}}>Password</label>
              <div style={{position:"relative"}}>
                <Lock size={17} color={focusField==="pass"?"#2563EB":"#94A3B8"} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
                <input type={showPwd?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required
                  onFocus={()=>setFocusField("pass")} onBlur={()=>setFocusField(null)}
                  style={{width:"100%",padding:"13px 44px 13px 44px",border:`1.5px solid ${error?"#FECACA":focusField==="pass"?"#2563EB":"#E2E8F0"}`,borderRadius:12,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",transition:"all 0.2s",background:error?"#FEF2F2":"#fff",boxShadow:focusField==="pass"?"0 0 0 4px rgba(37,99,235,0.08)":"",minHeight:48}}/>
                <button type="button" onClick={()=>setShowPwd(s=>!s)}
                  style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94A3B8",padding:4,display:"flex",minWidth:28,minHeight:28}}>
                  {showPwd?<EyeOff size={17}/>:<Eye size={17}/>}
                </button>
              </div>
            </div>

            <div style={{textAlign:"right",marginBottom:24}}>
              <span style={{fontSize:13,color:"#2563EB",cursor:"pointer",fontWeight:600}}>Forgot password?</span>
            </div>

            {error && (
              <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
                style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#DC2626",display:"flex",alignItems:"center",gap:8,fontWeight:500}}>
                ⚠️ {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading}
              style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:loading?"#93C5FD":"linear-gradient(135deg,#2563EB,#4F46E5)",color:"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.25s",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:loading?"none":"0 10px 25px rgba(37,99,235,0.3)",letterSpacing:"-0.01em",minHeight:52}}
              onMouseEnter={e=>{if(!loading){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 14px 30px rgba(37,99,235,0.4)"}}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 10px 25px rgba(37,99,235,0.3)"}}>
              {loading
                ? <><div style={{width:16,height:16,border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Signing in…</>
                : <>Sign In to Portal <ArrowRight size={18}/></>}
            </button>
          </form>

          <div style={{textAlign:"center",marginTop:28,fontSize:14,color:"#64748B"}}>
            Don't have an account?{" "}
            <span onClick={onGoSignUp} style={{color:"#2563EB",fontWeight:700,cursor:"pointer"}}>Create one →</span>
          </div>

          {/* Demo hints panel — click to autofill, passwords shown only for demo convenience */}
          <div style={{marginTop:32,padding:"16px 20px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:"1px",marginBottom:10}}>Demo Accounts</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {DEMO_HINTS.map(a=>(
                <div key={a.email} onClick={()=>{setEmail(a.email);setPassword(a.password);}}
                  style={{fontSize:12,color:"#475569",cursor:"pointer",display:"flex",justifyContent:"space-between",padding:"6px 0",transition:"color 0.15s",minHeight:32,alignItems:"center"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#2563EB"}
                  onMouseLeave={e=>e.currentTarget.style.color="#475569"}>
                  <span style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:8}}>{a.email}</span>
                  <span style={{color:"#94A3B8",flexShrink:0}}>{a.type}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── SIGN UP ─────────────────────────────────────────────────────────────────
function SignUp({ onSignedUp, onGoSignIn }) {
  const [form, setForm]       = useState({name:"",orgName:"",orgType:NGO_TYPES[0],email:"",password:"",confirm:""});
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { isMobile }          = useMediaQuery();

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name    = "Full name is required";
    if (!form.orgName.trim()) e.orgName = "Organisation name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Valid email is required";
    if (form.password.length < 6)          e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirm)    e.confirm  = "Passwords do not match";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      // 1. Create Firebase Auth account
      const result = await registerUser(form.email.trim().toLowerCase(), form.password);
      const user   = result.user;

      // 2. Save NGO profile to Firestore (no password stored)
      await setDoc(doc(db, "ngos", user.email), {
        name:      form.orgName.trim(),
        type:      form.orgType,
        ownerName: form.name.trim(),
        createdAt: new Date().toISOString(),
        stats:     { totalNeeds:0, volunteers:0, resolved:0, urgent:0 },
        needs: [], volunteers: [], notifications: [], uploads: [],
        chartData: {
          categories:[], regions:[],
          trends:[{month:"Oct",value:0},{month:"Nov",value:0},{month:"Dec",value:0},{month:"Jan",value:0},{month:"Feb",value:0},{month:"Mar",value:0}],
          resolution:[],
        },
      });

      setSuccess(true);
      setTimeout(() => onSignedUp({ email:user.email, name:form.orgName.trim(), type:form.orgType }), 1400);
    } catch (err) {
      setErrors({ submit: friendlyError(err.code) });
    } finally {
      setLoading(false);
    }
  };

  const inp = (k) => ({
    value: form[k],
    onChange: e => { set(k, e.target.value); setErrors(err=>({...err,[k]:""})); },
  });

  const eyeBtn = (show, setShow) => (
    <button type="button" onClick={()=>setShow(s=>!s)}
      style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94A3B8",padding:4,display:"flex"}}>
      {show?<EyeOff size={16}/>:<Eye size={16}/>}
    </button>
  );

  const fieldErr = (k) => errors[k]
    ? <div style={{fontSize:11,color:"#DC2626",marginTop:5,display:"flex",alignItems:"center",gap:4}}>⚠ {errors[k]}</div>
    : null;

  const lbl = (text) => (
    <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6}}>{text}</label>
  );

  if (success) return (
    <div style={{minHeight:"100vh",width:"100vw",background:"linear-gradient(135deg,#EFF6FF 0%,#F0FDF4 50%,#FFFBEB 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:isMobile?"0 20px":0}}>
      <div style={{textAlign:"center",padding:isMobile?24:40}}>
        <div style={{fontSize:isMobile?48:64,marginBottom:16}}>🎉</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:isMobile?20:24,color:"#0F172A",marginBottom:8}}>Account created!</div>
        <div style={{fontSize:14,color:"#64748B"}}>Signing you in to <strong>{form.orgName}</strong>…</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",width:"100vw",background:"linear-gradient(135deg,#EFF6FF 0%,#F0FDF4 50%,#FFFBEB 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:isMobile?"24px 16px":"32px 0"}}>
      <div style={{width:"100%",maxWidth:500,padding:isMobile?"0":"0 24px"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#2563EB,#8B5CF6)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16,fontSize:32,boxShadow:"0 12px 28px rgba(37,99,235,0.3)"}}>🤝</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"#0F172A",marginBottom:4}}>Create your account</h1>
          <p style={{fontSize:13,color:"#64748B"}}>Register your NGO on ReliefLink AI</p>
        </div>

        <div style={{background:"#fff",borderRadius:isMobile?16:20,border:"1px solid #E8EDF5",padding:isMobile?"24px 18px":"36px 32px",boxShadow:"0 20px 60px rgba(0,0,0,0.07)"}}>
          <form onSubmit={handleSubmit}>
            {/* Progress bar */}
            <div style={{display:"flex",gap:6,marginBottom:24}}>
              {["Your Info","Organisation","Security"].map((s,i)=>{
                const isActive = i===0?form.name:i===1?(form.name&&form.orgName):form.password;
                return (
                  <div key={s} style={{flex:1,textAlign:"center"}}>
                    <div style={{height:3,borderRadius:100,background:isActive?"linear-gradient(90deg,#2563EB,#6366F1)":"#E8EDF5",marginBottom:6,transition:"background 0.4s"}}/>
                    <span style={{fontSize:10,color:"#94A3B8",fontWeight:500}}>{s}</span>
                  </div>
                );
              })}
            </div>

            <div style={{marginBottom:16}}>
              {lbl("Your Full Name *")}
              <div style={{position:"relative"}}>
                <User size={16} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none"}}/>
                <input type="text" {...inp("name")} placeholder="e.g. Priya Sharma" required
                  style={{width:"100%",padding:"11px 12px 11px 38px",border:`1.5px solid ${errors.name?"#FECACA":"#E2E8F0"}`,borderRadius:10,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",minHeight:44}}/>
              </div>
              {fieldErr("name")}
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:16}}>
              <div>
                {lbl("Organisation Name *")}
                <div style={{position:"relative"}}>
                  <Building size={16} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none"}}/>
                  <input type="text" {...inp("orgName")} placeholder="e.g. Gujarat Care NGO" required
                    style={{width:"100%",padding:"11px 12px 11px 38px",border:`1.5px solid ${errors.orgName?"#FECACA":"#E2E8F0"}`,borderRadius:10,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",minHeight:44}}/>
                </div>
                {fieldErr("orgName")}
              </div>
              <div>
                {lbl("Organisation Type *")}
                <select value={form.orgType} onChange={e=>set("orgType",e.target.value)}
                  style={{width:"100%",padding:"11px 12px",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",background:"#fff",appearance:"none",cursor:"pointer",minHeight:44}}>
                  {NGO_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{marginBottom:16}}>
              {lbl("Work Email Address *")}
              <div style={{position:"relative"}}>
                <Mail size={16} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none"}}/>
                <input type="email" {...inp("email")} placeholder="you@organization.org" required
                  style={{width:"100%",padding:"11px 12px 11px 38px",border:`1.5px solid ${errors.email?"#FECACA":"#E2E8F0"}`,borderRadius:10,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",minHeight:44}}/>
              </div>
              {fieldErr("email")}
            </div>

            <div style={{marginBottom:16}}>
              {lbl("Password *")}
              <div style={{position:"relative"}}>
                <Lock size={16} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none"}}/>
                <input type={showPwd?"text":"password"} {...inp("password")} placeholder="Min. 6 characters" required
                  style={{width:"100%",padding:"11px 40px 11px 38px",border:`1.5px solid ${errors.password?"#FECACA":"#E2E8F0"}`,borderRadius:10,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",minHeight:44}}/>
                {eyeBtn(showPwd,setShowPwd)}
              </div>
              {form.password && !errors.password && (
                <div style={{display:"flex",gap:4,marginTop:6}}>
                  {[{l:"Weak",c:"#EF4444"},{l:"Fair",c:"#F59E0B"},{l:"Strong",c:"#16A34A"}].map((seg,i)=>(
                    <div key={seg.l} style={{flex:1,height:3,borderRadius:100,background:form.password.length>=(i===0?1:i===1?6:10)?seg.c:"#E8EDF5",transition:"background 0.3s"}}/>
                  ))}
                  <span style={{fontSize:10,color:"#94A3B8",marginLeft:6,flexShrink:0}}>
                    {form.password.length<6?"Weak":form.password.length<10?"Fair":"Strong"}
                  </span>
                </div>
              )}
              {fieldErr("password")}
            </div>

            <div style={{marginBottom:24}}>
              {lbl("Confirm Password *")}
              <div style={{position:"relative"}}>
                <Lock size={16} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none"}}/>
                <input type={showCfm?"text":"password"} {...inp("confirm")} placeholder="Re-enter your password" required
                  style={{width:"100%",padding:"11px 40px 11px 38px",border:`1.5px solid ${errors.confirm?"#FECACA":"#E2E8F0"}`,borderRadius:10,fontSize:14,fontFamily:"'Inter',sans-serif",color:"#0F172A",outline:"none",minHeight:44}}/>
                {eyeBtn(showCfm,setShowCfm)}
              </div>
              {fieldErr("confirm")}
            </div>

            {errors.submit && (
              <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
                style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#DC2626",display:"flex",alignItems:"center",gap:8,fontWeight:500}}>
                ⚠️ {errors.submit}
              </motion.div>
            )}

            <div style={{fontSize:12,color:"#64748B",marginBottom:20,lineHeight:1.6,padding:"12px 14px",background:"#F8FAFD",borderRadius:8,border:"1px solid #E8EDF5"}}>
              By creating an account you agree to ReliefLink AI's{" "}
              <span style={{color:"#2563EB",cursor:"pointer"}}>Terms of Service</span>{" "}and{" "}
              <span style={{color:"#2563EB",cursor:"pointer"}}>Privacy Policy</span>.
            </div>

            <button type="submit" disabled={loading}
              style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:loading?"#93C5FD":"linear-gradient(135deg,#2563EB,#6366F1)",color:"#fff",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 14px rgba(37,99,235,0.30)",minHeight:48}}>
              {loading
                ? <><div style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Creating account…</>
                : "Create Account →"}
            </button>
          </form>

          <div style={{textAlign:"center",marginTop:22,fontSize:13,color:"#64748B"}}>
            Already have an account?{" "}
            <span onClick={onGoSignIn} style={{color:"#2563EB",fontWeight:600,cursor:"pointer"}}>Sign in →</span>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:18,fontSize:11,color:"#94A3B8"}}>
          ReliefLink AI · Community Intelligence Platform · Gujarat
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('signin');

  if (mode === 'signup') {
    return <SignUp onSignedUp={onLogin} onGoSignIn={() => setMode('signin')} />;
  }
  return <SignIn onLogin={onLogin} onGoSignUp={() => setMode('signup')} />;
}