export function createQueryExecution(
  cancel: (isActive: () => boolean) => Promise<boolean>,
) {
  let active = true;
  let requested = false;
  let pending: Promise<boolean> | undefined;
  return {
    cancel: () => {
      if (!active) return Promise.resolve(false);
      requested = true;
      return (pending ??= Promise.resolve().then(() => cancel(() => active)));
    },
    assertRunning: () => {
      if (requested) throw new Error('Query cancelled by user.');
    },
    finish: async () => {
      active = false;
      // Retain the driver lease until a late control request can no longer hit its next borrower.
      await pending?.catch(() => {});
    },
  };
}

export function cancelQueryExecution(execution: unknown): Promise<boolean> {
  const handle = execution as { cancel?: () => Promise<boolean> } | null;
  return handle && typeof handle.cancel === 'function'
    ? handle.cancel()
    : Promise.resolve(false);
}
