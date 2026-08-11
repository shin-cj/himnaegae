'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MenuForm } from '@/components/MenuForm';
import type { AdminMenu } from '@/data/menu-data';
import { supabase } from '@/lib/supabase';

export default function EditMenuPage() {
  const params = useParams<{ id: string }>();
  const [menu, setMenu] = useState<AdminMenu | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: queryError } = await supabase.from('menus').select('*').eq('id', Number(params.id)).single();
      if (queryError) setError('메뉴를 찾지 못했어요.'); else setMenu(data as AdminMenu);
    })();
  }, [params.id]);

  if (error) return <main className="form-page form-message"><h1>{error}</h1><Link href="/menu">메뉴 관리로 돌아가기</Link></main>;
  if (!menu) return <main className="form-page form-message"><h1>메뉴를 불러오는 중이에요</h1></main>;
  return <main className="form-page"><div className="form-page-head"><Link href="/menu" aria-label="메뉴 관리로 돌아가기">‹</Link><div className="form-head-copy"><p>메뉴 관리</p><h1>메뉴 수정</h1><span>{menu.name}의 정보와 이미지를 변경할 수 있어요.</span></div></div><MenuForm mode="edit" initialMenu={menu} /></main>;
}
