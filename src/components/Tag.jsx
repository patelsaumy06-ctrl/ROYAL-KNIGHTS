import { G, css } from '../styles/theme';

export default function Tag({type, children}) {
  const map = {
    urgent: [G.redLight, G.red], medium: [G.amberLight, G.amber],
    low: [G.greenLight, G.green], active: [G.blueLight, G.blue],
    resolved: ["#F0FDF4","#16A34A"], processing: [G.amberLight,G.amber],
    done: ["#F0FDF4","#16A34A"], open: ["#FFF7ED","#C2410C"],
  };
  const [bg,color] = map[type]||[G.bg,G.t2];
  return <span style={css.tag(bg,color)}>{children}</span>;
}
