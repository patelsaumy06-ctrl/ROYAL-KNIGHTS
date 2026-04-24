import { useState, useEffect, useCallback, useMemo } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { G } from './styles/theme';
import { api } from './services/api';
import { backendApi } from './services/backendApi';
import { useNgoRealtimeData } from './hooks/useNgoRealtimeData';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useMediaQuery } from './hooks/useMediaQuery';
import { GOOGLE_MAPS_API_KEY } from './services/maps';
import { calculateRiskScore } from './core';
import { buildIntelligenceSnapshot } from './services/intelligence';
import { fetchWeather, FALLBACK_WEATHER, DEFAULT_WEATHER_COORDS } from './services/weather';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import QuickActionMenu from './components/QuickActionMenu';
import AIAssistant from './components/AIAssistant';
import WalkthroughOverlay from './components/WalkthroughOverlay';
import { AnimatePresence, motion } from 'framer-motion';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Insights from './pages/Insights';
import Map from './pages/Map';
import Upload from './pages/Upload';
import Volunteers from './pages/Volunteers';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import Auth from './pages/Auth';
import CommunityNeeds from './pages/CommunityNeeds';
import CrisisPipeline from './pages/CrisisPipeline';

export default function App() {
  const [page, setPage] = useState('landing');
  const [navCtx, setNavCtx] = useState(null);
  const [ngo, setNgo] = useState(null);

  const [showTour, setShowTour] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [smartMode, setSmartMode] = useState(true);
  const [manualEmergencyPauseUntil, setManualEmergencyPauseUntil] = useState(0);
  const [realtimeSimEnabled, setRealtimeSimEnabled] = useState(false);
  const [riskModel, setRiskModel] = useState({ score: 0, level: 'stable', autoEmergency: false });
  const [realWeather, setRealWeather] = useState(FALLBACK_WEATHER);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [volunteers, setVolunteers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const defaultIntelligence = {
    predictions: [],
    prioritizedTasks: [],
    recommendations: [],
    hotspotList: [],
    impact: {
      peopleHelped: 0,
      tasksCompleted: 0,
      activeTasks: 0,
      responseTimeImprovementPct: 0,
      resourceDistributionEfficiencyPct: 0,
      volunteerUtilizationPct: 0,
    },
    impactTrend: [],
  };
  const [aiSnapshot, setAiSnapshot] = useState({
    leadMessage: 'Monitoring incoming reports.',
    deployMessage: 'No urgent deployment recommended yet.',
    confidence: 70,
    riskScore: 0,
  });
  const { needs: liveNeeds, notifications: liveNotifications, unreadCount } = useNgoRealtimeData(ngo?.email);

  // Close sidebar on resize to desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen && !isDesktop) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen, isDesktop]);

  const evaluateEmergency = useCallback(async () => {
    const needs = liveNeeds || [];
    const notifs = liveNotifications || [];
    const vols = volunteers || [];
    const unresolved = (needs || []).filter((n) => n.status !== 'resolved');
    const urgent = unresolved.filter((n) => n.priority === 'urgent');
    const keywordPool = [
      ...unresolved.map((n) => `${n.category} ${n.location}`),
      ...notifs.slice(0, 8).map((n) => `${n.title} ${n.body}`),
    ]
      .join(' ')
      .toLowerCase();
    const keywords = ['flood', 'dengue', 'fire', 'rescue', 'medical'].filter((k) => keywordPool.includes(k));
    setWeatherLoading(true);
    let weatherForRisk = realWeather || FALLBACK_WEATHER;
    try {
      const nextWeather = await fetchWeather(DEFAULT_WEATHER_COORDS.lat, DEFAULT_WEATHER_COORDS.lon);
      weatherForRisk = nextWeather || FALLBACK_WEATHER;
      setRealWeather(weatherForRisk);
    } finally {
      setWeatherLoading(false);
    }

    const model = calculateRiskScore({
      reportCount: unresolved.length + (notifs || []).filter((n) => n.type === 'urgent').length,
      keywords,
      weather: weatherForRisk,
    });
    setRiskModel(model);
    const isManualPauseActive = Date.now() < manualEmergencyPauseUntil;
    setEmergency(!isManualPauseActive && model.autoEmergency);
    setAiSnapshot({
      leadMessage: model.autoEmergency 
        ? `High risk detected. ${urgent.length} urgent tasks require immediate attention.`
        : `System stable. ${urgent.length} urgent tasks under observation.`,
      deployMessage: urgent[0] 
        ? `Deploy ${Math.max(1, urgent[0].volunteers - urgent[0].assigned)} volunteers near ${urgent[0].location}.`
        : 'Rebalance teams to improve response coverage.',
      confidence: Math.max(55, Math.min(99, Math.round(60 + model.score * 0.35 + vols.filter(v => v.available).length))),
      riskScore: model.score,
    });
  }, [liveNeeds, liveNotifications, manualEmergencyPauseUntil, volunteers, realWeather]);

  useEffect(() => {
    if (!ngo) return;
    evaluateEmergency();
  }, [ngo, evaluateEmergency]);

  useEffect(() => {
    if (!ngo || !realtimeSimEnabled) return undefined;
    let disposed = false;
    let busy = false;

    const tick = async () => {
      if (busy || disposed) return;
      busy = true;
      try {
        await api.simulateIncident();
        if (Math.random() > 0.65) {
          await api.activateEmergencyMode();
        }
        await evaluateEmergency();
      } catch (error) {
        console.error('Realtime simulation tick failed', error);
      } finally {
        busy = false;
      }
    };

    tick();
    const handle = setInterval(tick, 12000);
    return () => {
      disposed = true;
      clearInterval(handle);
    };
  }, [ngo, realtimeSimEnabled, evaluateEmergency]);

  const { isOnline, cachedNeeds } = useOfflineSync({
    ngoEmail: ngo?.email,
    needs: liveNeeds,
    onReconnectSync: async () => {
      await evaluateEmergency();
    },
  });

  const effectiveNeeds = liveNeeds.length ? liveNeeds : cachedNeeds;

  useEffect(() => {
    if (!ngo) {
      setVolunteers([]);
      return undefined;
    }
    let active = true;
    api
      .getVolunteers()
      .then((items) => {
        if (active) setVolunteers(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setVolunteers([]);
      });
    return () => {
      active = false;
    };
  }, [ngo]);

  const intelligence = useMemo(() => {
    if (!ngo) return defaultIntelligence;
    return buildIntelligenceSnapshot({
      needs: effectiveNeeds,
      notifications: liveNotifications,
      volunteers,
      smartMode,
    });
  }, [ngo, effectiveNeeds, liveNotifications, volunteers, smartMode]);

  const handleLogin = async (account) => {
    api.setAccount(account.email);
    // Authenticate with backend:
    // 1. Try Firebase ID token first (works for all Firebase users)
    // 2. Fall back to password login (works for hardcoded demo accounts)
    try {
      if (account.firebaseIdToken) {
        backendApi.setToken(account.firebaseIdToken);
      } else if (account.password) {
        await backendApi.login(account.email, account.password);
      }
    } catch (e) {
      console.warn('Backend auth unavailable — AI features may be limited:', e.message);
    }
    localStorage.setItem('ReliefLink_current_ngo_email', account.email);
    setNgo(account);
    setPage('landing');
    const tourKey = `ReliefLink_tour_seen_${account.email}`;
    if (!localStorage.getItem(tourKey)) setShowTour(true);
  };

  const handleLogout = () => {
    api.setAccount(null);
    backendApi.clearToken();
    localStorage.removeItem('ReliefLink_current_ngo_email');
    setNgo(null);
    setPage('landing');
    setAuthView('signin');
    setShowTour(false);
    setEmergency(false);
    setManualEmergencyPauseUntil(0);
    setRealtimeSimEnabled(false);
    setSidebarOpen(false);
  };

  const handleDeactivateEmergency = () => {
    setEmergency(false);
    setManualEmergencyPauseUntil(Date.now() + 5 * 60 * 1000);
  };

  const handleNav = (p, ctx = null) => {
    setPage(p);
    setNavCtx(ctx);
  };
  const clearNavCtx = useCallback(() => setNavCtx(null), []);
  const sidebarNav = (p) => {
    setNavCtx(null);
    setPage(p);
    if (!isDesktop) setSidebarOpen(false);
  };

  if (!ngo) {
    return <Auth onLogin={handleLogin} />;
  }

  const pages = {
    landing: <Landing onNav={handleNav} />,
    dashboard: <Dashboard onNav={handleNav} emergency={emergency} onDeactivateEmergency={handleDeactivateEmergency} riskScore={riskModel.score} aiInsight={aiSnapshot.leadMessage} needsOverride={effectiveNeeds} />,
    insights: <Insights onNav={handleNav} onEmergencyActivated={evaluateEmergency} intelligence={intelligence} smartMode={smartMode} />,
    map: <Map onNav={handleNav} initialTask={navCtx} emergency={emergency} riskScore={riskModel.score} needsOverride={effectiveNeeds} ngoEmail={ngo?.email} />,
    communityNeeds: <CommunityNeeds onNav={handleNav} intelligence={intelligence} />,
    pipeline: <CrisisPipeline onNav={handleNav} intelligence={intelligence} />,
    upload: <Upload ngoEmail={ngo?.email} onImportSuccess={() => evaluateEmergency()} />,
    volunteers: <Volunteers initialTask={navCtx} needsOverride={effectiveNeeds} intelligence={intelligence} smartMode={smartMode} />,
    tasks: <Tasks onNav={handleNav} taskDraft={navCtx} onConsumeTaskDraft={clearNavCtx} emergency={emergency} prioritizedTasks={intelligence.prioritizedTasks} />,
    reports: <Reports intelligence={intelligence} />,

  };

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: G.bg, fontFamily: "'Inter',sans-serif", overflow: 'hidden', boxShadow: emergency ? 'inset 0 0 0 2px rgba(239,68,68,0.4), inset 0 0 140px rgba(239,68,68,0.12)' : undefined }}>
        {/* Sidebar backdrop for mobile */}
        {!isDesktop && (
          <div
            className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar
          active={page}
          onNav={sidebarNav}
          ngo={ngo}
          onLogout={handleLogout}
          unreadCount={unreadCount}
          isMobile={!isDesktop}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div style={{
          marginLeft: isDesktop ? 240 : 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: isDesktop ? 'calc(100vw - 240px)' : '100vw',
          minWidth: 0,
        }}>
          <TopBar
            page={page}
            onNav={sidebarNav}
            ngo={ngo}
            unreadCount={unreadCount}
            smartMode={smartMode}
            onToggleSmartMode={() => setSmartMode((prev) => !prev)}
            realtimeSimEnabled={realtimeSimEnabled}
            onToggleRealtimeSimulation={() => setRealtimeSimEnabled((prev) => !prev)}
            isMobile={isMobile}
            isTablet={isTablet}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          />
          <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} style={{ height: '100%' }}>
                {pages[page]}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        {(page !== 'landing' && page !== 'signin' && page !== 'signup') && (
          <>
            <QuickActionMenu
              isMobile={isMobile}
              onAction={async (act) => {
                if (act === 'task') handleNav('tasks', { openModal: true });
                if (act === 'volunteer') handleNav('volunteers', 'new');
                if (act === 'upload') handleNav('upload');
                if (act === 'emergency') {
                  await api.simulateIncident();
                  await evaluateEmergency();
                  setPage('dashboard');
                }
                if (act === 'smartAssign') handleNav('volunteers', { smartAssign: true });
              }}
            />
            <AIAssistant emergency={emergency} riskScore={riskModel.score} aiSnapshot={aiSnapshot} isMobile={isMobile} weatherLoading={weatherLoading} />
            {!isOnline && (
              <div style={{ position: 'fixed', right: isMobile ? 12 : 24, bottom: isMobile ? 12 : 24, padding: '8px 12px', borderRadius: 10, background: 'rgba(180,83,9,0.95)', color: '#fff', fontSize: 12, zIndex: 1200 }}>
                Offline mode: showing cached crisis data
              </div>
            )}
          </>
        )}
        {showTour && (
          <WalkthroughOverlay
            onComplete={() => {
              setShowTour(false);
              if (ngo?.email) localStorage.setItem(`ReliefLink_tour_seen_${ngo.email}`, 'true');
            }}
            onNav={handleNav}
          />
        )}
      </div>
    </APIProvider>
  );
}


