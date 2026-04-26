export async function register() {
  // Only run on the Node.js runtime (not edge), and only when DATABASE_URL is set
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL) {
    const { ensureSchema } = await import("./lib/db");
    await ensureSchema();
  }
}
