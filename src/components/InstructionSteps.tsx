import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Lightbulb, ListChecks } from "lucide-react";

type Props = {
  title: string;
  objective: string;
  steps: string[];
  tip?: string;
};

export default function InstructionSteps({ title, objective, steps, tip }: Props) {
  const [open, setOpen] = useState(true);
  const contentId = useId();

  return (
    <section className={`instruction-card premium-instruction-card ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="instruction-summary premium-instruction-summary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <div className="instruction-heading">
          <div className="instruction-heading-topline">
            <p className="eyebrow"><ListChecks size={14} /> How to play</p>
            <span className="instruction-collapse-hint">{open ? "Hide" : "Show"}</span>
          </div>
          <h2>{title}</h2>
          <p>{objective}</p>
        </div>
        <motion.span
          className="instruction-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
        >
          <ChevronDown size={19} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            className="instruction-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.27, ease: [0.22, 1, 0.36, 1] }}
          >
            <ol className="instruction-list">
              {steps.map((step, index) => (
                <motion.li
                  key={`${index}-${step}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.035, 0.16) }}
                >
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </motion.li>
              ))}
            </ol>
            {tip && (
              <p className="instruction-tip premium-tip">
                <Lightbulb size={16} /> <span><strong>Tip:</strong> {tip}</span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
