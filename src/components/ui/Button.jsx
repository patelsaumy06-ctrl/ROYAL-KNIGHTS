import { motion } from 'framer-motion';

const variants = {
  primary: 'from-[#4F46E5] to-[#22D3EE] text-white',
  danger: 'from-[#EF4444] to-[#fb7185] text-white',
  ghost: 'from-slate-700/60 to-slate-800/60 text-slate-200',
};

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.02, boxShadow: '0 0 26px rgba(34, 211, 238, 0.45)' }}
      className={`relative overflow-hidden rounded-xl bg-gradient-to-r px-4 py-2.5 text-sm font-semibold transition-all ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 transition-opacity hover:opacity-100" />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
