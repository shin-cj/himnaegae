'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

type MemberStatus = 'active' | 'blocked';
type Filter = 'all' | MemberStatus;
type Member = {
  user_id: string;
  email: string;
  nickname: string;
  status: MemberStatus;
  admin_note: string;
  created_at: string;
  last_sign_in_at: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};

const date = (value: string | null) => value ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '-';
const won = (value: number) => `${Number(value).toLocaleString('ko-KR')}원`;

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    setLoading(true);
    if (!sessionData.session) { router.replace('/'); return; }
    const { error: accessError } = await supabase.rpc('claim_first_admin');
    if (accessError) { setError('관리자 권한이 없어요.'); setLoading(false); return; }
    const { data, error: queryError } = await supabase.rpc('get_admin_members');
    if (queryError) setError('회원 정보를 불러오지 못했어요. DB 설정을 확인해주세요.');
    else { setMembers((data ?? []) as Member[]); setError(null); }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMembers]);

  const visibleMembers = useMemo(() => members.filter((member) => {
    const keyword = query.trim().toLowerCase();
    return (filter === 'all' || member.status === filter)
      && (!keyword || member.nickname.toLowerCase().includes(keyword) || member.email.toLowerCase().includes(keyword));
  }), [filter, members, query]);

  const updateStatus = async (member: Member) => {
    const nextStatus: MemberStatus = member.status === 'active' ? 'blocked' : 'active';
    const message = nextStatus === 'blocked'
      ? `${member.nickname} 회원의 이용을 제한할까요?`
      : `${member.nickname} 회원의 이용 제한을 해제할까요?`;
    if (!window.confirm(message)) return;
    setUpdatingId(member.user_id);
    const { error: updateError } = await supabase.rpc('update_member_management', {
      p_user_id: member.user_id, p_status: nextStatus, p_admin_note: member.admin_note,
    });
    if (updateError) setError('회원 상태를 변경하지 못했어요.');
    else setMembers((current) => current.map((item) => item.user_id === member.user_id ? { ...item, status: nextStatus } : item));
    setUpdatingId(null);
  };

  const activeCount = members.filter((member) => member.status === 'active').length;
  const totalOrders = members.reduce((sum, member) => sum + Number(member.order_count), 0);

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">🐾</span><div><strong>힘내개</strong><small>CAFE ADMIN</small></div></div>
        <nav aria-label="관리자 메뉴">
          <Link href="/"><span>▦</span><b>주문 관리</b></Link>
          <Link href="/menu"><span>☕</span><b>메뉴 관리</b></Link>
          <Link className="active" href="/members"><span>☺</span><b>회원 관리</b><em>{members.length}</em></Link>
          <Link href="/settings"><span>⚙</span><b>매장 설정</b></Link>
        </nav>
        <div className="store-card"><span className="online-dot" /><div><strong>힘내개 본점</strong><small>회원 정보 안전 관리</small></div></div>
      </aside>

      <main className="main members-main">
        <header className="topbar"><div><p className="overline">CUSTOMER MANAGEMENT</p><h1>회원 관리</h1><p>가입 회원과 주문 이용 현황을 확인하세요.</p></div><button className="refresh-button" onClick={() => void loadMembers()}>새로고침</button></header>

        <section className="member-stats">
          <article><small>전체 회원</small><strong>{members.length}명</strong></article>
          <article><small>정상 이용</small><strong>{activeCount}명</strong></article>
          <article><small>전체 주문</small><strong>{totalOrders}건</strong></article>
        </section>

        <section className="members-panel">
          <div className="members-tools">
            <div className="member-filters">
              {([{ key: 'all', label: '전체' }, { key: 'active', label: '정상 이용' }, { key: 'blocked', label: '이용 제한' }] as const).map((item) => (
                <button key={item.key} className={filter === item.key ? 'selected' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>
              ))}
            </div>
            <label className="menu-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="닉네임 또는 이메일 검색" /></label>
          </div>
          {error ? <div className="admin-error menu-error">{error}</div> : null}
          <div className="member-list-head"><span>회원</span><span>가입일</span><span>주문</span><span>누적 결제</span><span>최근 주문</span><span>상태</span><span>관리</span></div>
          <div className="member-list">
            {visibleMembers.map((member) => (
              <article className="member-row" key={member.user_id}>
                <div className="member-identity"><span>{member.nickname.slice(0, 1)}</span><div><strong>{member.nickname}</strong><small>{member.email}</small></div></div>
                <span>{date(member.created_at)}</span><strong>{member.order_count}건</strong><strong>{won(member.total_spent)}</strong><span>{date(member.last_order_at)}</span>
                <span className={`member-status ${member.status}`}>{member.status === 'active' ? '정상 이용' : '이용 제한'}</span>
                <button disabled={updatingId === member.user_id} className="member-manage" onClick={() => void updateStatus(member)}>{updatingId === member.user_id ? '변경 중' : member.status === 'active' ? '이용 제한' : '제한 해제'}</button>
              </article>
            ))}
            {loading ? <div className="empty-menu"><span>☺</span><strong>회원 정보를 불러오는 중이에요</strong></div> : null}
            {!loading && !visibleMembers.length ? <div className="empty-menu"><span>☺</span><strong>조건에 맞는 회원이 없어요</strong></div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
