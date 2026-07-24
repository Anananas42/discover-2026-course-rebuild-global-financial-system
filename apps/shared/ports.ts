// The single source of the fixed local port constellation. Every server,
// the start scripts, and the Vite configs import from here; each process
// still honors a PORT env override (used by smoke tests).
//
// The public addresses are the frontends; each proxies /api to its app's
// internal API port.

export const PORTS = {
  /** Board frontend (Vite, teacher's machine, visible on the LAN). */
  board: 4321,
  /** Guide frontend (Vite) — the page `pnpm start` opens. */
  guide: 4322,
  /** Financial system frontend (Vite). */
  financialSystem: 4323,
  /** Financial system API (tRPC). */
  financialSystemApi: 4330,
  /** Board API (internal; the board frontend proxies /api here). */
  boardApi: 4331,
  /** Guide API (internal; the guide frontend proxies /api here). */
  guideApi: 4332,
} as const;
