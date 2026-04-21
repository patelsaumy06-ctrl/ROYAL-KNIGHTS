import { useState, useEffect, useRef } from 'react';
import { G, css } from '../styles/theme';
import { api } from '../services/api';
import { backendApi } from '../services/backendApi';
import { callGeminiWithFile, readFileAsText, readFileAsBase64, priorityStyle } from '../services/gemini';
import Tag from '../components/Tag';
import Spinner from '../components/Spinner';

export default function Upload() {
  const [uploads, setUploads]           = useState(null);
  const [dragging, setDragging]         = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [currentFile, setCurrentFile]   = useState(null);
  const [steps, setSteps]               = useState([]);      // Processing log
  const [result, setResult]             = useState(null);    // Gemini parsed result
  const [error, setError]               = useState(null);
  const [confirmed, setConfirmed]       = useState(false);
  const [reportText, setReportText]     = useState('');     // Raw pasted report text
  const [inputMode, setInputMode]       = useState('file'); // 'file' | 'text'
  const fileInputRef                    = useRef(null);
 
  useEffect(() => { api.getUploads().then(setUploads); }, []);
 
  const addStep = (text, status = "done") =>
    setSteps(s => [...s, { text, status, time: new Date().toLocaleTimeString() }]);
 
  // ── Core processing pipeline ─────────────────────────────────────────────
  const processFile = async (file) => {
    setProcessing(true);
    setCurrentFile(file.name);
    setResult(null);
    setError(null);
    setConfirmed(false);
    setSteps([]);
  
    try {
      // STEP 1: Detect file type
      addStep(`Reading "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`);
        
      const isText  = file.type.includes("csv") || file.type.includes("text") || file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.name.endsWith(".xlsx");
      const isImage = file.type.includes("image");
      const isPDF   = file.type.includes("pdf");
  
      let fileContent, fileType;
  
      if (isText) {
        fileContent = await readFileAsText(file);
        fileType = "text";
        addStep(`Parsed ${fileContent.split("\n").length} rows of text data`);
      } else if (isImage || isPDF) {
        fileContent = await readFileAsBase64(file);
        fileType = file.type;
        addStep(`Encoded ${isPDF ? "PDF" : "image"} as base64 for multimodal AI`);
      } else {
        // Fallback: try reading as text
        fileContent = await readFileAsText(file);
        fileType = "text";
        addStep(`Reading as plain text (unknown format)`);
      }
  
      // STEP 2: Send to secure backend AI proxy
      addStep("Sending to AI analysis engine...", "loading");
  
      const parsed = await callGeminiWithFile(fileContent, fileType, file.name);
  
      setSteps(s => s.map((x, i) => i === s.length - 1 ? { ...x, status: "done" } : x));
  
      // STEP 3: Show results
      addStep(`Gemini extracted ${parsed.needs?.length || 0} community needs`);
      addStep(`AI generated ${parsed.aiInsights?.length || 0} priority insights`);
        
      setResult(parsed);
  
    } catch (err) {
      console.warn("Gemini API error, falling back to local demo generator:", err.message);
      const demoResult = generateDemoResult(file.name, fileContent);
      setSteps(s => s.map((x, i) => i === s.length - 1 ? { ...x, status: "done" } : x));
      addStep(`Fallback used: extracted ${demoResult.needs.length} community needs`);
      addStep(`Fallback used: generated ${demoResult.aiInsights.length} priority insights`);
      setResult(demoResult);
    }
      
    setProcessing(false);
  };
 
  // ── LLM-powered report analysis pipeline ──────────────────────────────
  // Takes raw pasted text → sends to backend → Claude/Gemini extracts structured data
  const processReport = async (text) => {
    if (!text.trim()) return;

    setProcessing(true);
    setCurrentFile('Field Report (pasted)');
    setResult(null);
    setError(null);
    setConfirmed(false);
    setSteps([]);

    try {
      addStep('Sending field report to AI analysis pipeline...', 'loading');

      const pipeline = await backendApi.processReport(text);

      setSteps(s => s.map((x, i) => i === s.length - 1 ? { ...x, status: 'done' } : x));

      const method = pipeline.report?._extraction_method || 'keyword_fallback';
      addStep(`AI extracted report data via ${method === 'llm_claude' ? 'Claude' : method === 'llm_gemini' ? 'Gemini' : 'keyword'} analysis`);
      addStep(`Identified ${pipeline.report?.needs?.length || 0} community needs with priority score ${pipeline.priority?.score || 'N/A'}`);

      // Transform pipeline result to the Upload result format
      const today = new Date();
      const transformed = {
        village: pipeline.report?.location || 'Unknown Village',
        region: pipeline.report?.location || 'Gujarat',
        totalRecords: pipeline.report?.needs?.length || 1,
        summary: pipeline.report?.summary || 'Field report analyzed by AI.',
        needs: (pipeline.report?.needs || []).map(n => ({
          category: n.type?.charAt(0).toUpperCase() + n.type?.slice(1) || 'Other',
          priority: n.priority === 'high' ? 'urgent' : n.priority || 'medium',
          volunteersNeeded: Math.max(2, Math.ceil((pipeline.priority?.score || 50) / 15)),
          description: `${n.type} need identified as ${n.priority} priority in ${pipeline.report?.location || 'affected area'}`,
          affectedPeople: pipeline.report?.affected_people_estimate || 0,
          deadline: new Date(today.getTime() + (n.priority === 'high' ? 3 : n.priority === 'medium' ? 7 : 14) * 86400000).toISOString().split('T')[0],
        })),
        aiInsights: [
          `Priority score: ${pipeline.priority?.score || 'N/A'}/100 (${pipeline.priority?.category || 'unclassified'})`,
          pipeline.report?.confidence_score ? `Confidence: ${Math.round(pipeline.report.confidence_score * 100)}%` : 'Confidence: not available',
          ...(pipeline.report?._reasoning?.needs ? [pipeline.report._reasoning.needs] : []),
        ],
      };

      setResult(transformed);
    } catch (err) {
      console.warn('LLM pipeline error, falling back to demo:', err.message);
      setSteps(s => s.map((x, i) => i === s.length - 1 ? { ...x, status: 'error' } : x));
      const demoResult = generateDemoResult('Field Report', text);
      addStep(`Fallback: extracted ${demoResult.needs.length} community needs (demo data)`);
      setResult(demoResult);
    }

    setProcessing(false);
  };

  // ── Confirm: push extracted needs into DB ────────────────────────────────
  const confirmAndSave = async () => {
    if (!result) return;
 
    const currentNeeds = await api.getNeeds();
    const nextId = Math.max(...currentNeeds.map(n => n.id), 0) + 1;
 
    const today = new Date();
    const newNeeds = result.needs.map((n, i) => ({
      id: nextId + i,
      location: result.village || "Unknown Village",
      category: n.category,
      region: result.region || "Gujarat",
      priority: n.priority,
      volunteers: n.volunteersNeeded || 5,
      assigned: 0,
      status: "open",
      deadline: n.deadline || new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0],
    }));
 
    const currentUploads = await api.getUploads();
    const newUpload = {
      id: currentUploads.length + 1,
      file: currentFile,
      village: result.village || "Unknown",
      issue: result.needs[0]?.category || "Multiple",
      records: result.totalRecords || result.needs.length,
      date: `Today ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      status: "done",
    };
 
    const currentNotifs = await api.getNotifications();
    const newNotification = {
      id: currentNotifs.length + 1,
      type: "upload",
      title: `New Upload: ${currentFile}`,
      body: `${result.totalRecords || result.needs.length} records processed. ${result.needs.filter(n => n.priority === "urgent").length} urgent needs identified by AI.`,
      time: "Just now",
      read: false,
    };
 
    // Save to Firestore
    const updatedUploads = await api.saveUploadNeeds(newNeeds, newUpload, newNotification);
    
    setUploads(updatedUploads);
    setConfirmed(true);
  };
 
  // ── Drag & Drop + click to browse ───────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };
 
  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };
 
  // ── Demo result generator (used when no API key is set) ──────────────────
  const generateDemoResult = (fileName, content) => {
    const rowCount = content ? content.split("\n").length : 50;
    return {
      village: "Rajpur Village",
      region: "Mehsana",
      totalRecords: rowCount,
      summary: `Survey data from ${fileName} containing ${rowCount} responses about community infrastructure needs.`,
      needs: [
        {
          category: "Water Crisis",
          priority: "urgent",
          volunteersNeeded: 8,
          description: "3 borewells non-functional for 2 weeks. ~4,200 residents collecting water from 5km away.",
          affectedPeople: 4200,
          deadline: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        },
        {
          category: "Medical Camp",
          priority: "medium",
          volunteersNeeded: 4,
          description: "No doctor visit in 3 months. High prevalence of fever and diarrhea cases reported.",
          affectedPeople: 1800,
          deadline: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        },
        {
          category: "School Supplies",
          priority: "low",
          volunteersNeeded: 2,
          description: "Primary school lacking notebooks, pencils and basic learning materials for 180 students.",
          affectedPeople: 180,
          deadline: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        },
      ],
      aiInsights: [
        "Water crisis is the most time-critical need — escalate immediately to Mehsana district coordinator",
        "Medical camp should be co-located with water distribution to maximise volunteer trips",
        "School supplies can be bundled with next regular delivery route to reduce logistics cost",
      ],
    };
  };
 
  const methods = [
    { icon: "📤", title: "Upload Survey", sub: "CSV, Excel, PDF", bg: "linear-gradient(135deg, #EFF6FF, #DBEAFE)" },
    { icon: "🔍", title: "Scan Paper Form", sub: "Camera · OCR", bg: "linear-gradient(135deg, #F0FDF4, #DCFCE7)" },
    { icon: "🎙️", title: "Record Voice", sub: "AI transcription", bg: "linear-gradient(135deg, #FFFBEB, #FEF3C7)" },
  ];

  return (
    <div style={{ padding: "40px clamp(20px, 5vw, 60px)", maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); filter: blur(4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.2); } 70% { box-shadow: 0 0 0 20px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .hover-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255,255,255,0.4); }
        .hover-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: ${G.shadowXl}; border-color: rgba(255,255,255,0.9); background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(255,255,255,0.6)); }
        .hover-card:active { transform: scale(0.98); }
        .drop-zone { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); position: relative; overflow: hidden; }
        .drop-zone::before { content: ''; position: absolute; inset: 0; background: linear-gradient(120deg, transparent, rgba(255,255,255,0.6), transparent); transform: translateX(-100%); transition: 0.6s; }
        .drop-zone:hover::before { transform: translateX(100%); }
        .drop-zone:hover { transform: translateY(-4px); box-shadow: ${G.shadowXl}; border-color: ${G.blueMid}; }
        .drop-zone:active { transform: scale(0.98); }
        .table-row { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); border-bottom: 1px solid rgba(226, 232, 240, 0.5); }
        .table-row:hover { background: rgba(255,255,255,0.8); transform: scale(1.005) translateX(4px); box-shadow: -4px 4px 10px rgba(0,0,0,0.02); border-radius: 8px; border-bottom-color: transparent; z-index: 10; position: relative; }
        .glass-panel { background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: ${G.shadowLg}; border-radius: 24px; overflow: hidden; }
      `}</style>
      
      {/* Header */}
      <div style={{ marginBottom: 40, animation: "slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: G.t1, marginBottom: 12, letterSpacing: "-0.03em", background: `linear-gradient(135deg, ${G.t1}, ${G.blueDark})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Data Ingestion</h1>
        <p style={{ fontSize: 16, color: G.t2, fontWeight: 500, maxWidth: 600, lineHeight: 1.6 }}>Upload surveys, field datasets, or automatically transcribe community feedback with our multimodal AI pipeline.</p>
      </div>

      {/* Method cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 40 }}>
        {methods.map((m, i) => (
          <div
            key={m.title}
            className="hover-card glass-panel"
            style={{ padding: "32px 24px", textAlign: "center", cursor: "pointer", animation: `slideIn 0.5s ease-out ${i * 0.1}s both` }}
            onClick={() => m.title === "Upload Survey" && fileInputRef.current?.click()}
          >
            <div style={{ width: 64, height: 64, background: m.bg, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), 0 8px 16px rgba(0,0,0,0.05)" }}>{m.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: G.t1, marginBottom: 6, letterSpacing: "-0.01em" }}>{m.title}</div>
            <div style={{ fontSize: 14, color: G.t3, fontWeight: 500 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.pdf,.jpg,.jpeg,.png,.txt" style={{ display: "none" }} onChange={handleFileInput} />

      {/* Input mode tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {['file', 'text'].map(mode => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              border: `2px solid ${inputMode === mode ? G.blue : 'rgba(226, 232, 240, 0.8)'}`,
              background: inputMode === mode ? `linear-gradient(135deg, ${G.blueLight}, rgba(219, 234, 254, 0.5))` : 'rgba(255,255,255,0.6)',
              color: inputMode === mode ? G.blueDark : G.t2,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
              backdropFilter: 'blur(8px)',
            }}
          >
            {mode === 'file' ? '📁 Upload File' : '📝 Paste Report'}
          </button>
        ))}
      </div>

      {/* Text paste area */}
      {inputMode === 'text' && (
        <div className="glass-panel" style={{ marginBottom: 40, padding: 32, animation: "fadeIn 0.4s ease-out" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: G.t1, marginBottom: 8 }}>Paste Field Report</div>
          <div style={{ fontSize: 14, color: G.t2, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>
            Paste raw NGO field report text below. The AI pipeline (Claude → Gemini → keyword fallback) will extract structured community needs, urgency levels, and priority scores.
          </div>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            placeholder={"Urgent: Severe flooding in Rajpur village, Mehsana district. 4,200 residents affected, 3 borewells non-functional for 2 weeks. Water collection from 5km away. Medical camp needed — no doctor visit in 3 months, fever and diarrhea cases rising. 1,800 people need immediate medical attention. School supplies also running low for 180 students."}
            style={{
              width: '100%',
              minHeight: 180,
              padding: '16px 20px',
              borderRadius: 16,
              border: '2px solid rgba(226, 232, 240, 0.6)',
              background: 'rgba(255,255,255,0.8)',
              fontSize: 14,
              lineHeight: 1.6,
              color: G.t1,
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = G.blue}
            onBlur={e => e.target.style.borderColor = 'rgba(226, 232, 240, 0.6)'}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 12, color: G.t3, fontWeight: 500 }}>{reportText.length} characters</span>
            <button
              style={{
                ...css.btn('primary', processing || !reportText.trim()),
                opacity: processing || !reportText.trim() ? 0.5 : 1,
                cursor: processing || !reportText.trim() ? 'not-allowed' : 'pointer',
              }}
              onClick={() => processReport(reportText)}
              disabled={processing || !reportText.trim()}
            >
              {processing ? '⏳ Analyzing...' : '🤖 AI Analyze Report'}
            </button>
          </div>
        </div>
      )}

      {/* Drop zone — only shown in file mode */}
      {inputMode === 'file' && (
      <div
        className="drop-zone glass-panel"
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? G.blue : "rgba(203, 213, 225, 0.8)"}`,
          padding: "70px 40px", textAlign: "center", cursor: "pointer",
          marginBottom: 40, 
          background: dragging ? "rgba(239, 246, 255, 0.8)" : "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)", 
          boxShadow: dragging ? `0 0 0 4px ${G.blueLight}, ${G.shadowXl}` : G.shadowLg,
          animation: dragging ? "pulseGlow 2s infinite" : "none",
        }}>
        <div style={{ width: 80, height: 80, background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px", boxShadow: "0 10px 25px rgba(37,99,235,0.15)", filter: dragging ? "drop-shadow(0 0 10px rgba(37,99,235,0.3))" : "none", transition: "all 0.3s" }}>{dragging ? "📥" : "📁"}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: G.t1, marginBottom: 12, letterSpacing: "-0.01em" }}>
          {processing ? `Analyzing "${currentFile}"...` : "Drag & Drop files here"}
        </div>
        <div style={{ fontSize: 15, color: G.t2, fontWeight: 500, marginBottom: dragging ? 0 : 20 }}>
          {dragging ? "Release to drop" : "or click to browse from your computer"}
        </div>
        {!dragging && <div style={{ fontSize: 13, color: G.t3, fontWeight: 600, display: "flex", justifyContent: "center", gap: 16 }}>
          <span>📄 CSV, Excel, PDF</span>
          <span>🖼️ JPG, PNG</span>
          <span>⚡ Max 50MB</span>
        </div>}
      </div>
      )}

      {/* Processing steps log */}
      {steps.length > 0 && (
        <div className="glass-panel" style={{ padding: 32, marginBottom: 40, animation: "fadeIn 0.4s ease-out" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: G.t1, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            {processing ? <div style={{width: 20, height: 20, borderRadius: "50%", border: `3px solid ${G.blueLight}`, borderTopColor: G.blue, animation: "spin 1s linear infinite"}} /> : error ? "❌" : "✅"}
            {processing ? "AI Analysis in Progress..." : error ? "Analysis Error" : "Analysis Complete"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", animation: `slideIn 0.3s ease-out ${i * 0.1}s both` }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: s.status === "error" ? G.redLight : s.status === "done" ? G.greenLight : G.blueLight, color: s.status === "error" ? G.red : s.status === "done" ? G.green : G.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                  {s.status === "done" ? "✓" : s.status === "error" ? "✗" : <div style={{width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: "pulseGlow 1s infinite"}} />}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: s.status === "error" ? G.redDark : G.t1 }}>{s.text}</span>
                  <span style={{ fontSize: 11, color: G.t3, fontWeight: 500 }}>{s.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gemini result card */}
      {result && !confirmed && (
        <div className="glass-panel" style={{ marginBottom: 40, animation: "fadeIn 0.5s ease-out" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, rgba(239, 246, 255, 0.8), rgba(219, 234, 254, 0.6))", padding: "30px 32px", borderBottom: `1px solid rgba(255,255,255,0.5)`, position: "relative", overflow: "hidden" }}>
             <div style={{ position: "absolute", top: "-50%", right: "-10%", width: 300, height: 300, background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)", opacity: 0.5, pointerEvents: "none" }} />
             <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ padding: "6px 12px", background: "rgba(37, 99, 235, 0.1)", color: G.blueDark, borderRadius: 100, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", border: "1px solid rgba(37, 99, 235, 0.2)" }}>
                    ✨ Gemini 1.5 Pro AI
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: G.t2 }}>{result.village}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: G.t1, marginBottom: 8, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{result.summary}</div>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: G.t2, fontWeight: 600 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>📊 {result.totalRecords} records</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>🗺️ {result.region} District</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>🎯 {result.needs.length} needs identified</span>
                </div>
             </div>
          </div>

          {/* Extracted needs */}
          <div style={{ padding: "30px 32px", borderBottom: `1px solid rgba(226, 232, 240, 0.4)` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: G.t2, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 20 }}>
              Extracted Community Needs
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              {result.needs.map((n, i) => {
                const ps = priorityStyle[n.priority] || priorityStyle.low;
                return (
                  <div key={i} className="hover-card" style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${ps.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", gap: 20, alignItems: "flex-start", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: ps.color }} />
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "6px 14px", borderRadius: 100, background: ps.border, color: ps.color, boxShadow: `0 2px 8px ${ps.border}` }}>
                        {n.priority.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: G.t1, marginBottom: 8 }}>{n.category}</div>
                      <div style={{ fontSize: 14, color: G.t2, lineHeight: 1.6, fontWeight: 500 }}>{n.description}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 24px", marginTop: 16, fontSize: 12, color: G.t2, fontWeight: 600 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.03)", padding: "4px 10px", borderRadius: 8 }}>👥 {n.volunteersNeeded} volunteers needed</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.03)", padding: "4px 10px", borderRadius: 8 }}>🧑‍🤝‍🧑 ~${n.affectedPeople?.toLocaleString()} affected</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.03)", padding: "4px 10px", borderRadius: 8 }}>📅 Deadline: {n.deadline}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI insights */}
          <div style={{ padding: "30px 32px", borderBottom: `1px solid rgba(226, 232, 240, 0.4)`, background: "linear-gradient(180deg, transparent, rgba(239, 246, 255, 0.3))" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: G.t2, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 20 }}>
              Strategic AI Insights
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {result.aiInsights.map((ins, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", background: "rgba(255,255,255,0.6)", padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: G.blueLight, color: G.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: 14, color: G.t1, lineHeight: 1.6, fontWeight: 600 }}>{ins}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confirm actions */}
          <div style={{ padding: "24px 32px", display: "flex", gap: 16, justifyContent: "flex-end", background: "rgba(255,255,255,0.4)" }}>
            <button style={{ ...css.btn("secondary", false), background: "rgba(255,255,255,0.8)", backdropFilter: "blur(4px)" }} onClick={() => { setResult(null); setSteps([]); }}>
              Discard Plan
            </button>
            <button style={{ ...css.btn("primary", false), transform: "translateY(0)", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"} onClick={confirmAndSave}>
              ✨ Import {result.needs.length} Needs to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Success state */}
      {confirmed && (
        <div className="glass-panel" style={{ padding: "40px 32px", marginBottom: 40, textAlign: "center", background: "linear-gradient(135deg, rgba(236, 253, 245, 0.9), rgba(209, 250, 229, 0.7))", borderColor: "#A7F3D0", animation: "fadeIn 0.5s ease-out" }}>
          <div style={{ width: 80, height: 80, background: G.surface, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 20px", boxShadow: "0 10px 25px rgba(16, 185, 129, 0.2)", animation: "pulseGlow 2s infinite" }}>✨</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: G.greenDark, marginBottom: 8, letterSpacing: "-0.01em" }}>
            {result?.needs.length} Needs Successfully Imported!
          </div>
          <div style={{ fontSize: 15, color: G.green, fontWeight: 600, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
            The community needs have been synced to your dashboard and are ready for volunteer assignment.
          </div>
          <button
            style={css.btn("green", false)}
            onClick={() => { setResult(null); setSteps([]); setConfirmed(false); setCurrentFile(null); }}>
            Upload Another File
          </button>
        </div>
      )}

      {/* Error card */}
      {error && (
        <div className="glass-panel" style={{ padding: "30px 32px", marginBottom: 40, background: "linear-gradient(135deg, rgba(254, 242, 242, 0.9), rgba(254, 226, 226, 0.7))", borderColor: "#FECACA", display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 64, height: 64, background: G.surface, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 10px 25px rgba(239, 68, 68, 0.15)" }}>❌</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: G.redDark, marginBottom: 4 }}>Analysis Failed</div>
            <div style={{ fontSize: 14, color: G.red, fontWeight: 500, lineHeight: 1.5 }}>{error}</div>
          </div>
          <button style={css.btn("danger", false)} onClick={() => { setError(null); setSteps([]); }}>Try Again</button>
        </div>
      )}

      {/* Recent uploads table */}
      {!uploads ? (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}><Spinner size={40} /></div>
      ) : (
        <div className="glass-panel" style={{ padding: 0 }}>
          <div style={{ padding: "24px 32px", borderBottom: `1px solid rgba(226, 232, 240, 0.4)`, background: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: G.t1 }}>Recent Ingestions</div>
          </div>
          <div style={{ overflowX: "auto", padding: "0 16px 16px 16px" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
              <thead>
                <tr>
                  {["File", "Village", "Issue", "Records", "Uploaded", "Status"].map(h => (
                    <th key={h} style={{ padding: "0 16px 8px 16px", textAlign: "left", fontSize: 12, fontWeight: 800, color: G.t3, textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploads.map(u => (
                  <tr key={u.id} className="table-row">
                    <td style={{ padding: "16px", fontWeight: 700, color: G.t1, fontSize: 14, borderRadius: "8px 0 0 8px" }}>{u.file}</td>
                    <td style={{ padding: "16px", color: G.t2, fontSize: 14, fontWeight: 500 }}>{u.village}</td>
                    <td style={{ padding: "16px", color: G.t2, fontSize: 14, fontWeight: 500 }}>{u.issue}</td>
                    <td style={{ padding: "16px", color: G.t2, fontSize: 14, fontWeight: 600 }}>{u.records}</td>
                    <td style={{ padding: "16px", color: G.t3, fontSize: 13, fontWeight: 500 }}>{u.date}</td>
                    <td style={{ padding: "16px", borderRadius: "0 8px 8px 0" }}>
                      <Tag type={u.status}>{u.status.charAt(0).toUpperCase() + u.status.slice(1)}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
