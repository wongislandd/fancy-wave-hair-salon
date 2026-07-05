export function publicAssetPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${normalizedPath}`;
}

export const salonHeroImage = publicAssetPath("assets/salon-hero.png");
