/**
 * RECONCILIATION NOTICE: DEPRECATED
 * 
 * This worker formerly contained duplicate timer logic. 
 * The RUQAYYA ERP Cycle Timer has been unified into a single Canonical Engine 
 * located in /server.ts (getCanonicalCycleStatus).
 * 
 * All pages, dashboards, and APIs now consume the real-time calculated 
 * state from the backend server to ensure there is ONLY ONE source of truth.
 * 
 * Background drifts and split-brain scenarios are resolved by 
 * centralizing calculations in the server-side engine.
 */

export default {
  async fetch(request: Request, env: any) {
    return new Response("This worker is deprecated. Use the canonical /api/cycles/status endpoint.", { status: 410 });
  },
  
  async scheduled(event: any, env: any, ctx: any) {
    console.log("Cycle timer worker scheduled tick ignored. Canonical engine in server.ts handles all calculations.");
  }
};
