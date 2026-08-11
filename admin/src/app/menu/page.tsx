'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { menuCategories, type AdminMenu } from '@/data/menu-data';
import { supabase } from '@/lib/supabase';

type Category = (typeof menuCategories)[number]['key'];

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const temperatureText: Record<AdminMenu['temperature'], string> = { HOT: 'HOT', ICE: 'ICE', BOTH: 'HOT · ICE' };

export default function MenuManagementPage() {
  const router = useRouter();
  const [menus, setMenus] = useState<AdminMenu[]>([]);
  const [category, setCategory] = useState<Category>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase.from('menus').select('*').order('sort_order').order('id');
    if (queryError) setError('메뉴를 불러오지 못했어요. DB 설정을 확인해주세요.');
    else { setMenus((data ?? []) as AdminMenu[]); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace('/'); return; }
      const { error: accessError } = await supabase.rpc('claim_first_admin');
      if (accessError) { setError('관리자 권한이 없어요.'); setLoading(false); return; }
      await loadMenus();
    })();
  }, [loadMenus, router]);

  const visibleMenus = useMemo(() => menus.filter((item) => {
    const categoryMatches = category === 'ALL' || item.category === category;
    const queryMatches = item.name.toLowerCase().includes(query.trim().toLowerCase());
    return categoryMatches && queryMatches;
  }), [category, menus, query]);

  const toggleAvailable = async (item: AdminMenu) => {
    setUpdatingId(item.id);
    const { error: updateError } = await supabase.from('menus').update({ available: !item.available }).eq('id', item.id);
    if (updateError) setError('판매 상태를 변경하지 못했어요.');
    else setMenus((current) => current.map((menu) => menu.id === item.id ? { ...menu, available: !menu.available } : menu));
    setUpdatingId(null);
  };

  const availableCount = menus.filter((item) => item.available).length;

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">🐾</span><div><strong>힘내개</strong><small>CAFE ADMIN</small></div></div>
        <nav aria-label="관리자 메뉴">
          <Link href="/"><span>▦</span><b>주문 관리</b></Link>
          <Link className="active" href="/menu"><span>☕</span><b>메뉴 관리</b><em>{menus.length}</em></Link>
          <Link href="/members"><span>☺</span><b>회원 관리</b></Link><Link href="/settings"><span>⚙</span><b>매장 설정</b></Link>
        </nav>
        <div className="store-card"><span className="online-dot" /><div><strong>힘내개 본점</strong><small>고객 앱과 메뉴 연결</small></div></div>
      </aside>

      <main className="main menu-main">
        <header className="menu-page-header">
          <div className="menu-page-title">
            <div><p className="overline">HIMNAEGAE COFFEE</p><h1>메뉴 관리</h1><p>판매 메뉴와 가격, 품절 상태를 관리하세요.</p></div>
          </div>
          <Link className="primary-action" href="/menu/new">＋ 새 메뉴 추가</Link>
        </header>

        <section className="menu-stats">
          <article><small>전체 메뉴</small><strong>{menus.length}개</strong></article>
          <article><small>판매 중</small><strong>{availableCount}개</strong></article>
          <article><small>품절</small><strong>{menus.length - availableCount}개</strong></article>
        </section>

        <section className="menu-panel">
          <div className="menu-tools">
            <div className="menu-category-tabs">
              {menuCategories.map((item) => <button key={item.key} className={category === item.key ? 'selected' : ''} onClick={() => setCategory(item.key)}>{item.label}</button>)}
            </div>
            <label className="menu-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="메뉴 이름 검색" /></label>
          </div>
          {error ? <div className="admin-error menu-error">{error}<button onClick={() => void loadMenus()}>다시 불러오기</button></div> : null}

          <div className="menu-list-head"><span>메뉴</span><span>제공 온도</span><span>가격</span><span>판매 상태</span><span>관리</span></div>
          <div className="menu-list">
            {visibleMenus.map((item) => (
              <article className={`menu-row ${item.available ? '' : 'sold-out'}`} key={item.id}>
                <div className="menu-identity">
                  <span className="menu-emoji">{item.image_url ? <Image src={item.image_url} alt="" width={48} height={48} unoptimized /> : item.emoji}</span>
                  <div><strong>{item.name}</strong><small>{item.category.replace('_', ' & ')} {item.tag ? `· ${item.tag}` : ''}</small></div>
                </div>
                <span className={`temperature ${item.temperature.toLowerCase()}`}>{temperatureText[item.temperature]}</span>
                <strong className="menu-price">{won(item.price)}</strong>
                <button disabled={updatingId === item.id} className={`availability ${item.available ? 'on' : 'off'}`} onClick={() => void toggleAvailable(item)}><span />{updatingId === item.id ? '변경 중' : item.available ? '판매 중' : '품절'}</button>
                <Link className="edit-menu" href={`/menu/${item.id}/edit`}>수정</Link>
              </article>
            ))}
            {!loading && !visibleMenus.length ? <div className="empty-menu"><span>☕</span><strong>표시할 메뉴가 없어요</strong><p>새 메뉴를 추가하거나 검색 조건을 바꿔보세요.</p></div> : null}
            {loading ? <div className="empty-menu"><span>☕</span><strong>메뉴를 불러오는 중이에요</strong></div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
