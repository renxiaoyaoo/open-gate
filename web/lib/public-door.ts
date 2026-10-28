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
  publicId: string;
  name: string;
  communityName: string | null;
  passwordSupported: boolean;
  providerFeatured: boolean;
  selected: boolean;
  refreshedAt: number;
}): PublicDoor {
  return { id: row.publicId, name: row.name, communityName: row.communityName, passwordSupported: row.passwordSupported, providerFeatured: row.providerFeatured, selected: row.selected, refreshedAt: row.refreshedAt };
}
