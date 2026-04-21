import { ShieldAlert, LayoutDashboard, MapPinned, Users, BarChart3, Bot } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'Live Map', icon: MapPinned },
  { id: 'volunteers', label: 'Volunteers', icon: Users },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'assistant', label: 'AI Center', icon: Bot },
];

export default function Sidebar({ active, onChange, emergency }) {
  return (
    <aside className={`glass fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-700/40 p-4 ${emergency ? 'shadow-[0_0_20px_rgba(239,68,68,0.45)]' : ''}`}>
      <div className="mb-8 flex items-center gap-3 rounded-2xl bg-slate-900/70 p-3">
        <ShieldAlert className="text-cyan-300" />
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Echo5</p>
          <p className="font-bold text-white">Crisis OS</p>
        </div>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onChange(item.id)}
              whileHover={{ x: 4 }}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                isActive
                  ? 'border-cyan-300/60 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.2)]'
                  : 'border-transparent text-slate-300 hover:border-indigo-400/50 hover:bg-indigo-500/10'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </motion.button>
          );
        })}
      </nav>
    </aside>
  );
}
