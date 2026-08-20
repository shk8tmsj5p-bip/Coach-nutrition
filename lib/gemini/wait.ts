type Listener = (label: string | null) => void;

const listeners = new Set<Listener>();
let depth = 0;
let current: string | null = null;

function emit() {
  const label = depth > 0 ? current : null;
  listeners.forEach((fn) => fn(label));
}

export function subscribeGeminiWait(fn: Listener) {
  listeners.add(fn);
  fn(depth > 0 ? current : null);
  return () => {
    listeners.delete(fn);
  };
}

export async function withGeminiWait<T>(label: string, task: () => Promise<T>): Promise<T> {
  depth += 1;
  current = label;
  emit();
  try {
    return await task();
  } finally {
    depth -= 1;
    if (depth <= 0) {
      depth = 0;
      current = null;
    }
    emit();
  }
}
