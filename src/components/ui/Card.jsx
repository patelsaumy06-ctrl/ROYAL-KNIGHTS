import { motion } from 'framer-motion';

export default function Card({ children, className = '' }) {
  return (
    <motion.article
      whileHover={{ y: -4, rotateX: 1.5, rotateY: -1.5 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      className={`glass neon-shadow rounded-2xl p-5 ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </motion.article>
  );
}
