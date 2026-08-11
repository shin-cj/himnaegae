export type AdminMenu = {
  id: number;
  category: 'BEST_NEW' | 'COFFEE' | 'LATTE' | 'ADE' | 'TEA';
  emoji: string;
  name: string;
  description: string;
  price: number;
  temperature: 'HOT' | 'ICE' | 'BOTH';
  tag?: 'BEST' | 'NEW';
  available: boolean;
  image_url: string | null;
  image_path: string | null;
  sort_order: number;
};

const menu = (id: number, category: AdminMenu['category'], emoji: string, name: string, price: number, temperature: AdminMenu['temperature'] = 'BOTH', tag?: AdminMenu['tag']): AdminMenu => ({
  id, category, emoji, name, description: '', price, temperature, tag, available: true, image_url: null, image_path: null, sort_order: id,
});

export const initialMenus: AdminMenu[] = [
  menu(1, 'BEST_NEW', '☕', '달고나라떼', 3000, 'BOTH', 'BEST'),
  menu(2, 'BEST_NEW', '🥛', '달고나밀크', 2500),
  menu(3, 'BEST_NEW', '🍠', '우베라떼', 3500, 'BOTH', 'NEW'),
  menu(4, 'BEST_NEW', '🥛', '우베밀크', 3000),
  menu(5, 'BEST_NEW', '🍨', '아이스크림라떼', 3900, 'ICE'),
  menu(6, 'COFFEE', '☕', '아메리카노', 2000),
  menu(7, 'COFFEE', '☕', '카페라떼', 2500),
  menu(8, 'COFFEE', '🥛', '두유라떼', 2500),
  menu(9, 'COFFEE', '☕', '카푸치노', 2500, 'HOT'),
  menu(10, 'COFFEE', '☕', '바닐라라떼', 2800),
  menu(11, 'COFFEE', '☕', '헤이즐넛라떼', 2800),
  menu(12, 'COFFEE', '🍫', '카페모카', 3000),
  menu(13, 'COFFEE', '☕', '카라멜마끼아또', 3000),
  menu(14, 'COFFEE', '🥛', '돌체라떼', 3000),
  menu(15, 'COFFEE', '🥜', '투피넛라떼', 3900),
  menu(16, 'LATTE', '🍵', '녹차라떼', 3500),
  menu(17, 'LATTE', '🍫', '초코라떼', 3500),
  menu(18, 'LATTE', '🌿', '쑥라떼', 3500),
  menu(19, 'LATTE', '🌾', '오곡라떼', 3500, 'ICE'),
  menu(20, 'LATTE', '🍓', '딸기라떼', 3900, 'ICE'),
  menu(21, 'LATTE', '🍠', '고구마라떼', 3900),
  menu(22, 'LATTE', '🧋', '밀크티', 3900),
  menu(23, 'ADE', '🍊', '청귤에이드', 3500, 'ICE'),
  menu(24, 'ADE', '🍇', '청포도에이드', 3500, 'ICE'),
  menu(25, 'ADE', '🍋', '레몬에이드', 3500, 'ICE'),
  menu(26, 'ADE', '🍒', '체리에이드', 3500, 'ICE'),
  menu(27, 'TEA', '🍑', '복숭아아이스티', 2000, 'ICE'),
  menu(28, 'TEA', '🫖', '자스민', 2500, 'HOT'),
  menu(29, 'TEA', '🫖', '루이보스', 2500, 'HOT'),
  menu(30, 'TEA', '🌿', '페퍼민트', 2500, 'HOT'),
  menu(31, 'TEA', '🌼', '캐모마일', 2500, 'HOT'),
  menu(32, 'TEA', '🍊', '청귤차', 3000, 'HOT'),
  menu(33, 'TEA', '🍊', '유자차', 3000, 'HOT'),
  menu(34, 'TEA', '🫚', '생강차', 3000, 'HOT'),
  menu(35, 'TEA', '🍋', '레몬차', 3500, 'HOT'),
  menu(36, 'TEA', '🍒', '오미자차', 3900),
];

export const menuCategories = [
  { key: 'ALL', label: '전체' },
  { key: 'BEST_NEW', label: 'BEST & NEW' },
  { key: 'COFFEE', label: 'COFFEE' },
  { key: 'LATTE', label: 'LATTE' },
  { key: 'ADE', label: 'ADE' },
  { key: 'TEA', label: 'TEA' },
] as const;
