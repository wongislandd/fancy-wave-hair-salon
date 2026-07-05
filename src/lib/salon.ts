export const salonName = "Fancy Wave Beauty Salon";
export const salonAddress = "135-45 Roosevelt Ave, Flushing, NY 11354";
export const salonMapsQuery = `${salonName}, ${salonAddress}`;

const encodedSalonMapsQuery = encodeURIComponent(salonMapsQuery);

export const googleMapsEmbedUrl = `https://www.google.com/maps?q=${encodedSalonMapsQuery}&output=embed`;
export const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedSalonMapsQuery}`;
