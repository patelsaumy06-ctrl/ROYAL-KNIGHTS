import { Bell, Search, Siren, UserCircle2 } from 'lucide-react';
import Button from './Button';

export default function Topbar({ emergency, setEmergency }) {
  return (
    <header className="glass sticky top-0 z-30 mb-5 flex items-center justify-between rounded-2xl px-5 py-3">
      <div className="flex items-center gap-3 rounded-xl bg-slate-900/70 px-3 py-2 text-slate-300">
        <Search size={16} />
        <input
          placeholder="Search crisis, location, volunteer..."
          className="w-72 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-2 text-slate-200 transition hover:border-cyan-400/70">
          <Bell size={18} />
        </button>
        <Button
          variant={emergency ? 'danger' : 'ghost'}
          className="flex items-center gap-2"
          onClick={() => setEmergency((prev) => !prev)}
        >
          <Siren size={16} />
          {emergency ? 'Emergency Active' : 'Emergency Mode'}
        </Button>
        <button className="rounded-xl border border-indigo-400/50 bg-indigo-500/20 p-2 text-cyan-200">
          <UserCircle2 size={20} />
        </button>
      </div>
    </header>
  );
}
