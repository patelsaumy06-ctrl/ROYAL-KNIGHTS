import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { G } from '../styles/theme';

export default function BarChart({data, height=160}) {
  const safeData = data || [];
  return (
    <div style={{ height, width: "100%", paddingTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={safeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <Tooltip
            cursor={{fill: `${G.blue}11`}}
            contentStyle={{borderRadius: 8, border: `1px solid ${G.border}`, boxShadow: G.shadow, padding: 12, fontWeight: 600, fontSize: 12, color: G.t1}}
            itemStyle={{color: G.t2, fontSize: 12}}
          />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: G.t3, fontWeight: 500}} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: G.t3}} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
            {safeData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || G.blue} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
