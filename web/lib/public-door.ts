export type PublicDoor = {
  id: string;
  name: string;
  communityName: string | null;
  passwordSupported: boolean;
  providerFeatured: boolean;
  selected: boolean;
  refreshedAt: number;
};

export function publicDoor(row: {
  publicId: string | null;
  name: string;
  communityName: string | null;
  passwordSupported: boolean;
  providerFeatured: boolean;
  selected: boolean;
  refreshedAt: number;
}): PublicDoor | null {
  if (!row.publicId) return null;
  return { id: row.publicId, name: row.name, communityName: row.communityName, passwordSupported: row.passwordSupported, providerFeatured: row.providerFeatured, selected: row.selected, refreshedAt: row.refreshedAt };
}
