import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DROP_LABEL, useDrag } from "../lib/drag";

/** Floating card that follows the pointer while an order is being moved. */
export function DragLayer() {
  const { order, x, y, over } = useDrag();
  if (!order) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: over ? 1.04 : 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute w-[220px] -translate-x-1/2 -translate-y-[120%] rounded-[12px] border border-navy/15 bg-white px-3 py-2 shadow-[0_18px_40px_-12px_rgba(27,44,86,0.45)]"
        style={{ left: x, top: y }}
      >
        <div className="flex items-center gap-2">
          <span className="font-extrabold">{order.label}</span>
          <span className="truncate text-mute">{order.customer}</span>
        </div>
        <div className="truncate text-[12px] text-mute">{order.itemsText}</div>
        <div className={over ? "mt-1.5 flex items-center gap-1 text-[12px] font-extrabold text-accent" : "mt-1.5 text-[12px] font-semibold text-faint"}>
          {over ? (
            <>
              Move to {DROP_LABEL[over]} <ArrowRight className="size-3.5" />
            </>
          ) : (
            "Drop on a station"
          )}
        </div>
      </motion.div>
    </div>
  );
}
