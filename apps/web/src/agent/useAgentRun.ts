import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "../editor/store";
import { fetchPlan } from "./agentClient";

/** Delay between revealing each agent step (matches the prototype cadence). */
const STEP_MS = 760;

/**
 * Drives an agent run: fetches a plan from the server, then reveals its steps on a
 * timer by advancing the store. `loading` covers the fetch gap before steps appear.
 */
export function useAgentRun() {
  const phase = useEditorStore((s) => s.phase);
  const active = useEditorStore((s) => s.active);
  const advance = useEditorStore((s) => s.advance);
  const startRun = useEditorStore((s) => s.startRun);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reveal steps on a cadence while the run is in progress.
  useEffect(() => {
    if (phase !== "running") return;
    timer.current = setTimeout(advance, STEP_MS);
    return () => clearTimeout(timer.current);
  }, [phase, active, advance]);

  const run = useCallback(
    async (prompt: string) => {
      setLoading(true);
      try {
        const { plan } = await fetchPlan(prompt);
        startRun(plan.title, plan.steps);
      } finally {
        setLoading(false);
      }
    },
    [startRun],
  );

  return { run, loading };
}
