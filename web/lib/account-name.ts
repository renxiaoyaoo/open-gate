export function personalDisplayName(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["nickName", "nickname", "userName", "username", "realName", "name"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 64);
  }
  for (const key of ["data", "user", "userInfo", "personalInfo", "member"]) {
    const candidate = personalDisplayName(record[key]);
    if (candidate) return candidate;
  }
  return null;
}
