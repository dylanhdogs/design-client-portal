interface ShutdownDependencies {
  closeServer: (callback: (error?: Error) => void) => void;
  disconnectDatabase: () => Promise<unknown>;
  exitProcess: (code: number) => void;
  scheduleForcedExit?: (callback: () => void, timeoutMs: number) => { unref: () => unknown };
  log?: (entry: string) => void;
  timeoutMs?: number;
}

export const createGracefulShutdown = ({
  closeServer,
  disconnectDatabase,
  exitProcess,
  scheduleForcedExit = (callback, timeoutMs) => setTimeout(callback, timeoutMs),
  log = console.log,
  timeoutMs = 10_000,
}: ShutdownDependencies) => {
  let stopping = false;

  return (signal: string): void => {
    if (stopping) return;
    stopping = true;
    log(JSON.stringify({ level: 'info', event: 'server_stopping', signal }));
    closeServer((error) => {
      void disconnectDatabase().finally(() => exitProcess(error ? 1 : 0));
    });
    scheduleForcedExit(() => exitProcess(1), timeoutMs).unref();
  };
};

