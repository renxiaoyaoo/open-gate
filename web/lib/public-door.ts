export type PublicDoor = {
  id: string;
  name: string;
  communityName: string | null;
  passwordSupported: boolean;
  refreshedAt: number;
};

export function publicDoor(row: {
  publicId: string | null;
  name: string;
  communityName: string | null;
  passwordSupported: boolean;
  refreshedAt: number;
}): PublicDoor | null {
  if (!row.publicId) return null;
  return { id: row.publicId, name: row.name, communityName: row.communityName, passwordSupported: row.passwordSupported, refreshedAt: row.refreshedAt };
}
