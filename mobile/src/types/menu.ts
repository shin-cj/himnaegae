export type MenuCategory = 'BEST_NEW' | 'COFFEE' | 'LATTE' | 'ADE' | 'TEA';

export type MenuTemperature = 'HOT' | 'ICE' | 'BOTH';

export type Menu = {
  id: number;
  category: MenuCategory;
  emoji: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  temperature?: MenuTemperature;
  tag?: 'BEST' | 'NEW';
};

export type MenuSelection = {
  temperature: Exclude<MenuTemperature, 'BOTH'>;
  extraShot: boolean;
  soyMilk: boolean;
  personalTumbler: boolean;
  quantity: number;
};

export type CartItem = MenuSelection & {
  key: string;
  menuId: number;
  menuName: string;
  unitPrice: number;
};
