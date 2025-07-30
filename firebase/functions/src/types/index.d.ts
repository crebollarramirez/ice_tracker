export interface PinLocation {
  addedAt: string; // ISO 8601 timestamp
  address: string;
  additionalInfo?: string;
  lat: number;
  lng: number;
}
