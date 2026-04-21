import React from 'react';
import { motion } from 'framer-motion';
import { G, css } from '../styles/theme';
import { HeartHandshake, MapPin, AlertTriangle, Package } from 'lucide-react';
import Tag from '../components/Tag';
import { useMediaQuery } from '../hooks/useMediaQuery';

const fadeIn = (delay=0) => ({initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:0.5,delay,ease:[0.16,1,0.3,1]}});

export default function CommunityNeeds({ onNav, intelligence }) {
  const { isMobile, isTablet } = useMediaQuery();
  
  const needs = intelligence?.prioritizedTasks || [];
  
  return (
    <motion.div {...fadeIn()} style={{padding: isMobile ? "16px 12px 48px" : "28px 32px 48px", minHeight: '100vh'}}>
      <motion.div {...fadeIn(0.05)} style={{marginBottom:28}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#EFF6FF,#EEF2FF)",border:"1px solid #DBEAFE",borderRadius:100,padding:"5px 14px",fontSize:11.5,color:G.blue,fontWeight:700,marginBottom:14}}>
          <HeartHandshake size={13}/> Community Needs
        </div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:G.t1,letterSpacing:"-0.02em",margin:0}}>Active Community Requirements</h2>
        <p style={{fontSize:14,color:G.t2,marginTop:8,maxWidth:600}}>Browse and manage the direct needs expressed by the community, prioritized by AI based on urgency, location, and impact potential.</p>
      </motion.div>

      <motion.div {...fadeIn(0.1)} style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20}}>
        {needs.length === 0 ? (
          <div style={{gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: G.surface, borderRadius: 16, border: `1px solid ${G.border}`}}>
            <HeartHandshake size={48} color={G.t3} style={{margin: '0 auto 16px', opacity: 0.5}}/>
            <h3 style={{fontSize: 16, color: G.t1, marginBottom: 8}}>No Active Needs</h3>
            <p style={{fontSize: 14, color: G.t2}}>The community is currently stable. New reports will appear here.</p>
          </div>
        ) : needs.map((need, idx) => (
          <motion.div key={need.id || idx} {...fadeIn(0.1 + idx * 0.05)} style={{
            background: G.surface,
            borderRadius: 16,
            border: `1px solid ${need.priorityLabel === 'Critical' ? '#FECACA' : G.border}`,
            padding: 20,
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: G.shadow,
            cursor: 'pointer'
          }}
          whileHover={{y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.06)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: need.priorityLabel === 'Critical' ? '#FEF2F2' : '#EFF6FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: need.priorityLabel === 'Critical' ? G.red : G.blue
                }}>
                  {need.priorityLabel === 'Critical' ? <AlertTriangle size={20} /> : <Package size={20} />}
                </div>
                <div>
                  <h3 style={{fontSize: 15, fontWeight: 700, color: G.t1, margin: 0}}>{need.category}</h3>
                  <div style={{fontSize: 12, color: G.t3, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4}}>
                    <MapPin size={12}/> {need.location}
                  </div>
                </div>
              </div>
              <Tag type={need.priorityLabel === 'Critical' ? 'urgent' : 'medium'}>{need.priorityLabel || 'Standard'}</Tag>
            </div>
            
            <p style={{fontSize: 13, color: G.t2, lineHeight: 1.5, marginBottom: 16, borderTop: `1px solid ${G.border}`, paddingTop: 16}}>
              {need.description || `Required support for ${need.category} at ${need.location}.`}
            </p>
            
            <div style={{background: G.bg, borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
               <div style={{fontSize: 12, color: G.t2}}>
                 <span style={{fontWeight: 700, color: G.t1}}>{need.assigned || 0}/{need.volunteers || 0}</span> Volunteers
               </div>
               <button 
                onClick={() => onNav('volunteers', { needId: need.id })}
                style={{...css.btn('primary'), padding: '6px 12px', fontSize: 12, borderRadius: 6}}>
                 Assign
               </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
