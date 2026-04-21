import React from 'react';
import { motion } from 'framer-motion';
import { G, css } from '../styles/theme';
import { Zap, ShieldAlert, Clock } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

const fadeIn = (delay=0) => ({initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:0.5,delay,ease:[0.16,1,0.3,1]}});

export default function CrisisPipeline({ onNav, intelligence }) {
  const { isMobile } = useMediaQuery();
  
  const predictions = intelligence?.predictions || [];
  const activeNeeds = intelligence?.prioritizedTasks || [];
  
  // Fake some pipeline stages based on data
  const stages = [
    {
      id: 'detected',
      title: 'AI Detected & Predicted',
      icon: <ShieldAlert size={20} />,
      color: G.violet,
      items: predictions
    },
    {
      id: 'active',
      title: 'Active Responses',
      icon: <Zap size={20} />,
      color: G.amber,
      items: activeNeeds.filter(n => (n.assigned || 0) < (n.volunteers || 1))
    },
    {
      id: 'resolving',
      title: 'Resolving',
      icon: <Clock size={20} />,
      color: G.blue,
      items: activeNeeds.filter(n => (n.assigned || 0) >= (n.volunteers || 1) && ((n.assigned || 0) > 0))
    }
  ];

  return (
    <motion.div {...fadeIn()} style={{padding: isMobile ? "16px 12px 48px" : "28px 32px 48px", minHeight: '100vh'}}>
      <motion.div {...fadeIn(0.05)} style={{marginBottom:32}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#FFFBEB,#FEF3C7)",border:"1px solid #FDE68A",borderRadius:100,padding:"5px 14px",fontSize:11.5,color:G.amber,fontWeight:700,marginBottom:14}}>
          <Zap size={13}/> Crisis Pipeline
        </div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:G.t1,letterSpacing:"-0.02em",margin:0}}>Live Response Pipeline</h2>
        <p style={{fontSize:14,color:G.t2,marginTop:8,maxWidth:600}}>Track the flow of crisis events from initial AI detection through active deployment and final resolution.</p>
      </motion.div>

      <div style={{display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 24, overflowX: 'auto', paddingBottom: 20}}>
        {stages.map((stage, sIdx) => (
          <motion.div key={stage.id} {...fadeIn(0.1 + sIdx * 0.1)} style={{
            flex: 1,
            minWidth: isMobile ? '100%' : 320,
            background: G.surface,
            borderRadius: 20,
            border: `1px solid ${G.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${G.border}`,
              background: `linear-gradient(to right, ${stage.color}08, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <div style={{color: stage.color}}>{stage.icon}</div>
                <h3 style={{fontSize: 15, fontWeight: 600, color: G.t1, margin: 0}}>{stage.title}</h3>
              </div>
              <div style={{background: G.bg, padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: `1px solid ${G.border}`}}>
                {stage.items.length}
              </div>
            </div>
            
            <div style={{padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12, background: G.bg}}>
              {stage.items.length === 0 ? (
                <div style={{padding: 30, textAlign: 'center', color: G.t3, fontSize: 13, border: `1px dashed ${G.border}`, borderRadius: 12}}>
                  No items in this stage
                </div>
              ) : stage.items.map((item, iIdx) => (
                <div key={item.id || iIdx} style={{
                  background: G.surface,
                  borderRadius: 12,
                  padding: 16,
                  border: `1px solid ${G.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{fontSize: 13.5, fontWeight: 600, color: G.t1, marginBottom: 6}}>
                    {item.predictedNeedType || item.category || 'Unknown Event'}
                  </div>
                  <div style={{fontSize: 12, color: G.t2, marginBottom: 12}}>
                    {item.location || 'Multiple areas'}
                  </div>
                  {stage.id === 'detected' ? (
                    <div style={{fontSize: 11, color: stage.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
                      Confidence: {item.confidenceScore}%
                    </div>
                  ) : (
                    <div style={{height: 4, background: G.bg, borderRadius: 2, overflow: 'hidden'}}>
                      <div style={{
                        height: '100%', 
                        background: stage.color, 
                        width: `${Math.min(100, ((item.assigned||0) / (item.volunteers||1)) * 100)}%`
                      }}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
