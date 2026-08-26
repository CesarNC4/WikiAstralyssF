"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/** Wrapper de animación reutilizable (§6). Respeta reduced-motion vía CSS global. */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { duration: 0.4, delay } } }}
    >
      {children}
    </motion.div>
  );
}
