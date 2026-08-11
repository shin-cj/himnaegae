export type StoreBusinessStatus = 'open' | 'paused' | 'closed';

export type StoreSettings = {
  storeName: string;
  businessStatus: StoreBusinessStatus;
  notice: string;
  phone: string;
  address: string;
  openTime: string;
  closeTime: string;
  pickupMin: number;
  pickupMax: number;
  pickupGuide: string;
};

