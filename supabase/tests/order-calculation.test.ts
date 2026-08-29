import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateOrderTotals,
  ClientInputError,
  normalizeOrderItems,
  type MenuRow,
} from '../functions/_shared/order-calculation.ts';

const menus: MenuRow[] = [
  { id: 1, name: '아메리카노', price: 3_500, temperature: 'BOTH', available: true },
  { id: 2, name: '따뜻한 차', price: 4_000, temperature: 'HOT', available: true },
  { id: 3, name: '품절 메뉴', price: 5_000, temperature: 'ICE', available: false },
];

test('클라이언트 가격과 이름을 무시하고 DB 메뉴 기준으로 다시 계산한다', () => {
  const [item] = normalizeOrderItems([{
    menu_id: 1,
    menu_name: '조작된 이름',
    unit_price: 100,
    temperature: 'ICE',
    quantity: 2,
    extra_shot_count: 2,
    personal_tumbler: true,
  }], menus);

  assert.equal(item.menu_name, '아메리카노');
  assert.equal(item.unit_price, 4_300);
  assert.deepEqual(calculateOrderTotals([item]), { totalQuantity: 2, total: 8_600 });
});

test('기존 extra_shot 요청도 샷 한 번으로 정규화한다', () => {
  const [item] = normalizeOrderItems([{
    menu_id: 1,
    temperature: 'HOT',
    quantity: 1,
    extra_shot: true,
  }], menus);

  assert.equal(item.extra_shot_count, 1);
  assert.equal(item.extra_shot, true);
  assert.equal(item.unit_price, 4_000);
});

test('품절 메뉴와 존재하지 않는 메뉴를 거부한다', () => {
  assert.throws(() => normalizeOrderItems([{ menu_id: 3, temperature: 'ICE', quantity: 1 }], menus), ClientInputError);
  assert.throws(() => normalizeOrderItems([{ menu_id: 999, temperature: 'ICE', quantity: 1 }], menus), ClientInputError);
});

test('메뉴에서 허용하지 않는 온도를 거부한다', () => {
  assert.throws(
    () => normalizeOrderItems([{ menu_id: 2, temperature: 'ICE', quantity: 1 }], menus),
    /온도 선택을 확인해주세요/,
  );
});

test('수량과 샷 추가 범위를 검증한다', () => {
  assert.throws(() => normalizeOrderItems([{ menu_id: 1, temperature: 'ICE', quantity: 0 }], menus), /수량/);
  assert.throws(() => normalizeOrderItems([{ menu_id: 1, temperature: 'ICE', quantity: 21 }], menus), /수량/);
  assert.throws(() => normalizeOrderItems([{ menu_id: 1, temperature: 'ICE', quantity: 1, extra_shot_count: 6 }], menus), /샷 추가/);
});
