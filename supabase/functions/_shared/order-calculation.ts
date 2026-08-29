export class ClientInputError extends Error {}

export type MenuRow = {
  id: number;
  name: string;
  price: number;
  temperature: 'HOT' | 'ICE' | 'BOTH';
  available: boolean;
};

export type NormalizedOrderItem = {
  menu_id: number;
  menu_name: string;
  temperature: 'HOT' | 'ICE';
  extra_shot: boolean;
  extra_shot_count: number;
  lightly: boolean;
  soy_milk: boolean;
  personal_tumbler: boolean;
  quantity: number;
  unit_price: number;
};

export function normalizeOrderItems(items: unknown[], menuRows: MenuRow[]): NormalizedOrderItem[] {
  const menuById = new Map(menuRows.map((menu) => [menu.id, menu]));

  return items.map((value) => {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const menu = menuById.get(Number(item.menu_id));
    const quantity = Number(item.quantity);
    const temperature = item.temperature === 'HOT' ? 'HOT' : item.temperature === 'ICE' ? 'ICE' : null;

    if (!menu || !menu.available) throw new ClientInputError('품절되었거나 판매하지 않는 메뉴가 포함되어 있어요.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new ClientInputError('메뉴 수량이 올바르지 않아요.');
    if (!temperature || (menu.temperature !== 'BOTH' && menu.temperature !== temperature)) {
      throw new ClientInputError(`${menu.name}의 온도 선택을 확인해주세요.`);
    }

    const extraShotCount = Number(item.extra_shot_count ?? (item.extra_shot ? 1 : 0));
    if (!Number.isInteger(extraShotCount) || extraShotCount < 0 || extraShotCount > 5) {
      throw new ClientInputError('샷 추가 수량을 확인해주세요.');
    }

    const personalTumbler = item.personal_tumbler === true;
    return {
      menu_id: menu.id,
      menu_name: menu.name,
      temperature,
      extra_shot: extraShotCount > 0,
      extra_shot_count: extraShotCount,
      lightly: item.lightly === true,
      soy_milk: item.soy_milk === true,
      personal_tumbler: personalTumbler,
      quantity,
      unit_price: menu.price + extraShotCount * 500 - (personalTumbler ? 200 : 0),
    };
  });
}

export function calculateOrderTotals(items: NormalizedOrderItem[]) {
  return {
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
  };
}
