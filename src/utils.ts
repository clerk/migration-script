export async function cooldown(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}
