import { useState, useEffect, useRef } from 'react';
import { G, css } from '../styles/theme';
import { deleteNeed, getAllIncidents, updateNeedStatus } from '../services/firestoreRealtime';
import Tag from '../components/Tag';
import Spinner from '../components/Spinner';
import AddTaskModal from '../components/AddTaskModal';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function Tasks({ onNav, taskDraft, onConsumeTaskDraft, emergency = false, prioritizedTasks = [] }) {
  const [needs, setNeeds] = useState(null);
  const [filter, setFilter] = useState('all');
  const [resolving, setResolving] = useState({});
  const [deleting, setDeleting] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalInitialDraft, setModalInitialDraft] = useState(null);
  const [loadError, setLoadError] = useState('');
  const lastConsumed = useRef(null);
  const { isMobile } = useMediaQuery();

  useEffect(() => {
    const email = localStorage.getItem('Needlink_current_ngo_email');
    if (!email) {
      setNeeds([]);
      return;
    }
    getAllIncidents(email)
      .then((items) => {
        setNeeds(items);
        setLoadError('');
      })
      .catch((error) => {
        console.error(error);
        setNeeds([]);
        setLoadError(error?.message || 'Failed to load incidents.');
      });
  }, []);

  useEffect(() => {
    if (!taskDraft) {
      lastConsumed.current = null;
      return;
    }
    const key = JSON.stringify(taskDraft);
    if (lastConsumed.current === key) return;

    if (taskDraft.openModal) {
      const { openModal: _openModal, ...rest } = taskDraft;
      setModalInitialDraft(Object.keys(rest).length ? rest : null);
      setShowModal(true);
      lastConsumed.current = key;
      onConsumeTaskDraft?.();
      return;
    }

    if (taskDraft.focusNeedId != null) {
      lastConsumed.current = key;
      onConsumeTaskDraft?.();
    }
  }, [taskDraft, onConsumeTaskDraft]);

  const handleResolve = async (id) => {
    setResolving((r) => ({ ...r, [id]: true }));
    try {
      const email = localStorage.getItem('Needlink_current_ngo_email');
      if (!email) throw new Error('Missing logged-in NGO email.');
      await updateNeedStatus(email, id, 'resolved');
      setNeeds((n) => n.map((x) => (x.id === id ? { ...x, status: 'resolved' } : x)));
    } catch (error) {
      setLoadError(error?.message || 'Failed to update incident status.');
    } finally {
      setResolving((r) => ({ ...r, [id]: false }));
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Remove this task permanently?');
    if (!ok) return;
    setDeleting((d) => ({ ...d, [id]: true }));
    try {
      const email = localStorage.getItem('Needlink_current_ngo_email');
      if (!email) throw new Error('Missing logged-in NGO email.');
      await deleteNeed(email, id);
      setNeeds((curr) => curr.filter((n) => n.id !== id));
    } catch (error) {
      setLoadError(error?.message || 'Failed to delete incident.');
    } finally {
      setDeleting((d) => ({ ...d, [id]: false }));
    }
  };

  if (!needs) return <Spinner />;

  const filtered = filter === 'all' ? needs : needs.filter((n) => n.status === filter);
  const taskScoreMap = new Map(prioritizedTasks.map((task) => [String(task.id), task]));
  const smartOrdered = [...filtered].sort(
    (a, b) => (taskScoreMap.get(String(b.id))?.priorityScore || 0) - (taskScoreMap.get(String(a.id))?.priorityScore || 0)
  );
  const pinned = needs.find((item) => item.priority === 'urgent' && item.status !== 'resolved') || needs[0];

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 32 }}>
      {showModal && (
        <AddTaskModal
          key={modalInitialDraft ? `${modalInitialDraft.lat}-${modalInitialDraft.lng}` : 'new'}
          initialDraft={modalInitialDraft}
          onClose={() => {
            lastConsumed.current = null;
            setShowModal(false);
            setModalInitialDraft(null);
          }}
          onSave={async () => {
            const email = localStorage.getItem('Needlink_current_ngo_email');
            const list = email ? await getAllIncidents(email) : [];
            setNeeds(list);
            setShowModal(false);
            setModalInitialDraft(null);
          }}
        />
      )}
      {loadError && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #FCA5A5',
            background: '#FEF2F2',
            color: '#B91C1C',
            fontSize: 12,
          }}
        >
          {loadError}
        </div>
      )}
      <div style={{ ...css.flex(0, 'center', 'space-between'), marginBottom: 20, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0 }}>
        <div style={{ ...css.flex(8), flexWrap: 'wrap' }}>
          {['all', 'active', 'open', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-label={`Filter by ${f}`}
              style={{
                padding: '6px 16px',
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: `1px solid ${filter === f ? G.blue : G.border}`,
                background: filter === f ? G.blue : G.surface,
                color: filter === f ? '#fff' : G.t2,
                transition: 'all 0.15s',
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setModalInitialDraft(null);
            setShowModal(true);
          }}
          aria-label="Create new task"
          style={css.btn('primary', true)}
        >
          + New Task
        </button>
      </div>

      {prioritizedTasks.length > 0 && (
        <div
          style={{
            ...css.card(),
            padding: '12px 16px',
            marginBottom: 16,
            border: '1px solid #FECACA',
            background: 'linear-gradient(135deg,#FEF2F2,#FFF1F2)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>Smart Task Panel</div>
          <div style={{ fontSize: 12, color: '#7F1D1D' }}>
            Tasks are ranked by AI priority score (urgency + impact + severity + resource gap).
          </div>
        </div>
      )}

      {pinned && (
        <div
          style={{
            background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
            border: `1px solid #BFDBFE`,
            borderRadius: 14,
            padding: isMobile ? '16px 14px' : '24px 28px',
            marginBottom: 24,
            ...css.flex(0, 'flex-start', 'space-between'),
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 16 : 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: G.blue,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              PINNED INCIDENT
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: G.t1, marginBottom: 10 }}>
              {pinned.category} — {pinned.location}
            </div>
            <div style={{ ...css.flex(8) }}>
              <Tag type={pinned.priority}>{pinned.priority}</Tag>
              <span style={{ ...css.tag(G.blueLight, G.blue) }}>{pinned.region}</span>
              <span style={{ ...css.tag(G.greenLight, G.green) }}>{pinned.volunteers} Volunteers Needed</span>
              {pinned?.aiAnalysis?.riskScore ? (
                <span style={{ ...css.tag('#FEF2F2', '#B91C1C') }}>AI Risk {pinned.aiAnalysis.riskScore}/10</span>
              ) : null}
            </div>
            {pinned?.aiAnalysis?.summary ? (
              <div style={{ marginTop: 10, fontSize: 12, color: G.t2, maxWidth: 580 }}>{pinned.aiAnalysis.summary}</div>
            ) : null}
          </div>
          <div style={{ ...css.flex(8) }}>
            <button style={css.btn('secondary', true)} onClick={() => onNav('map', pinned.id)} aria-label="View pinned incident details">
              Details
            </button>
            <button style={css.btn('primary', true)} onClick={() => onNav('volunteers', pinned.id)} aria-label="Match volunteers for pinned incident">
              Match Volunteers
            </button>
          </div>
        </div>
      )}

      <div style={css.card()}>
        <div style={{ padding: '16px 22px 12px', borderBottom: `1px solid ${G.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: G.t1 }}>Task Registry · {filtered.length} records</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 700 : 'auto' }}>
            <thead>
              <tr style={{ background: G.bg }}>
                {['Task', 'Location', 'Progress', 'Deadline', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: G.t3,
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      borderBottom: `1px solid ${G.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {smartOrdered.map((n) => (
                <tr
                  key={n.id}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = G.bg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '';
                  }}
                  style={{ transition: 'background 0.1s', boxShadow: emergency && n.priority === 'urgent' && n.status !== 'resolved' ? 'inset 0 0 0 1px rgba(239,68,68,0.35)' : undefined, background: emergency && n.priority === 'urgent' && n.status !== 'resolved' ? 'rgba(127,29,29,0.12)' : undefined }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 500, color: G.t1, fontSize: 13, borderBottom: `1px solid ${G.border}` }}>
                    <div>{n.category}</div>
                    {taskScoreMap.get(String(n.id)) ? (
                      <div style={{ marginTop: 6, fontSize: 11, color: G.t3 }}>
                        AI Priority {taskScoreMap.get(String(n.id)).priorityScore} · {taskScoreMap.get(String(n.id)).priorityLabel}
                      </div>
                    ) : null}
                    {n?.aiAnalysis?.tags?.length ? (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {n.aiAnalysis.tags.slice(0, 3).map((tag) => (
                          <span key={tag} style={{ ...css.tag('#EEF2FF', '#4338CA') }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {n?.aiAnalysis?.summary ? (
                      <div style={{ marginTop: 6, color: G.t3, fontSize: 11, maxWidth: 260 }}>{n.aiAnalysis.summary}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '14px 16px', color: G.t2, fontSize: 13, borderBottom: `1px solid ${G.border}` }}>{n.location}</td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${G.border}`, minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: G.t3, marginBottom: 4 }}>
                      {n.assigned}/{n.volunteers} volunteers
                    </div>
                    <div style={{ background: G.bg, borderRadius: 100, height: 5, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${n.volunteers > 0 ? (n.assigned / n.volunteers) * 100 : 0}%`,
                          background: G.blue,
                          height: '100%',
                          borderRadius: 100,
                        }}
                      />
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      fontSize: 13,
                      color: n.priority === 'urgent' ? G.red : G.t2,
                      fontWeight: n.priority === 'urgent' ? 600 : 400,
                      borderBottom: `1px solid ${G.border}`,
                    }}
                  >
                    {n.deadline}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${G.border}` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Tag type={n.priority}>{n.priority.charAt(0).toUpperCase() + n.priority.slice(1)}</Tag>
                      {n?.aiAnalysis?.classification?.severityScore ? (
                        <span style={{ fontSize: 11, color: G.t3 }}>
                          Severity {n.aiAnalysis.classification.severityScore}/10
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${G.border}` }}>
                    <Tag type={n.status}>{n.status.charAt(0).toUpperCase() + n.status.slice(1)}</Tag>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${G.border}`, ...css.flex(6) }}>
                    {n.status !== 'resolved' && (
                      <>
                        <button style={css.btn('primary', true)} onClick={() => onNav('volunteers', n.id)} aria-label={`Match volunteers for ${n.category}`}>
                          Match
                        </button>
                        <button
                          disabled={resolving[n.id]}
                          onClick={() => handleResolve(n.id)}
                          aria-label={`Resolve ${n.category} task`}
                          style={css.btn('secondary', true)}
                        >
                          {resolving[n.id] ? '…' : 'Resolve'}
                        </button>
                        <button
                          disabled={deleting[n.id]}
                          onClick={() => handleDelete(n.id)}
                          aria-label={`Remove ${n.category} task`}
                          style={{ ...css.btn('secondary', true), borderColor: '#FCA5A5', color: '#B91C1C' }}
                        >
                          {deleting[n.id] ? '…' : 'Remove'}
                        </button>
                      </>
                    )}
                    {n.status === 'resolved' && (
                      <span style={{ fontSize: 11, color: G.green, fontWeight: 600 }}>✓ Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
