import { useCallback, useRef, useState } from "react";
import { getJob, submitEditJob, type EditJob } from "./workerClient";

export type EditPhase = "idle" | "uploading" | "running" | "done" | "error";

/** Runs a real edit job against the worker: upload → poll → done, with status for the UI. */
export function useEditJob() {
  const [phase, setPhase] = useState<EditPhase>("idle");
  const [job, setJob] = useState<EditJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const run = useCallback(async (file: File, opts: { captions?: boolean } = {}) => {
    cancelled.current = false;
    setError(null);
    setJob(null);
    setPhase("uploading");
    try {
      const submitted = await submitEditJob(file, opts);
      if (cancelled.current) return;
      setJob(submitted);
      setPhase("running");

      let current = submitted;
      while (current.status === "queued" || current.status === "running") {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled.current) return;
        current = await getJob(submitted.id);
        setJob(current);
      }
      if (current.status === "done") setPhase("done");
      else {
        setPhase("error");
        setError(current.error || "the edit failed");
      }
    } catch (err) {
      if (cancelled.current) return;
      setPhase("error");
      setError((err as Error).message);
    }
  }, []);

  const reset = useCallback(() => {
    cancelled.current = true;
    setPhase("idle");
    setJob(null);
    setError(null);
  }, []);

  return { phase, job, error, run, reset };
}
