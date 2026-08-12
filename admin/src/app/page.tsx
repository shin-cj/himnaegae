'use client';

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type OrderStatus = 'payment_pending' | 'paid' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'cancel_requested' | 'cancelled';
type Filter = 'active' | 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'all';
type DateScope = 'today' | 'all';

type OrderItem = {
  id: number;
  menu_name: string;
  temperature: 'HOT' | 'ICE';
  extra_shot: boolean;
  extra_shot_count: number;
  lightly: boolean;
  soy_milk: boolean;
  personal_tumbler: boolean;
  quantity: number;
};

type AdminOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'failed';
  total_amount: number;
  pickup_at: string | null;
  pickup_type: 'asap' | 'scheduled' | null;
  cancellation_reason: string | null;
  created_at: string;
  order_items: OrderItem[];
};

const statusText: Record<OrderStatus, string> = {
  payment_pending: '결제 확인 중', paid: '접수 됨', accepted: '접수 됨', preparing: '제조 중',
  ready: '픽업 준비 완료', picked_up: '픽업 완료', cancel_requested: '취소 요청', cancelled: '주문 취소',
};

const nextStatus: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  paid: { status: 'preparing', label: '제조 시작' },
  accepted: { status: 'preparing', label: '제조 시작' },
  preparing: { status: 'ready', label: '픽업 준비 완료' },
  ready: { status: 'picked_up', label: '픽업 완료' },
};

const filters: { key: Filter; label: string }[] = [
  { key: 'active', label: '진행 중' }, { key: 'new', label: '접수 됨' },
  { key: 'preparing', label: '제조 중' }, { key: 'ready', label: '픽업 준비 완료' },
  { key: 'completed', label: '픽업 완료' }, { key: 'cancelled', label: '취소' }, { key: 'all', label: '전체' },
];

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const isActive = (status: OrderStatus) => !['picked_up', 'cancelled'].includes(status);
const isNew = (status: OrderStatus) => status === 'paid' || status === 'accepted';

export default function Home() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [dateScope, setDateScope] = useState<DateScope>('today');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertToast, setAlertToast] = useState<{ title: string; body: string } | null>(null);
  const alertsEnabledRef = useRef(false);
  const knownOrderStatusRef = useRef(new Map<string, OrderStatus>());
  const initialOrdersLoadedRef = useRef(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id,order_number,status,payment_status,total_amount,pickup_at,pickup_type,cancellation_reason,created_at,order_items(id,menu_name,temperature,extra_shot,extra_shot_count,lightly,soy_milk,personal_tumbler,quantity)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (queryError) setError('주문을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    else {
      const nextOrders = (data ?? []) as AdminOrder[];
      if (!initialOrdersLoadedRef.current) {
        nextOrders.forEach((order) => knownOrderStatusRef.current.set(order.id, order.status));
        initialOrdersLoadedRef.current = true;
      }
      setOrders(nextOrders);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const enabled = window.localStorage.getItem('himnaegae-admin-alerts') === 'on'
      && typeof Notification !== 'undefined'
      && Notification.permission === 'granted';
    alertsEnabledRef.current = enabled;
    window.queueMicrotask(() => setAlertsEnabled(enabled));
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void (async () => {
      const { error: claimError } = await supabase.rpc('claim_first_admin');
      if (!active) return;
      if (claimError) {
        setAccessDenied(true);
        setError('이 계정에는 관리자 권한이 없어요.');
        return;
      }
      setAccessDenied(false);
      await loadOrders();
    })();
    const timer = window.setInterval(() => void loadOrders(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [loadOrders, session]);

  useEffect(() => {
    if (!session || accessDenied) return;

    const notifyAdmin = (title: string, body: string) => {
      setAlertToast({ title, body });
      window.setTimeout(() => setAlertToast(null), 6000);
      if (!alertsEnabledRef.current) return;
      playAlertSound();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico', tag: title + body });
      }
    };

    const channel = supabase
      .channel('admin-live-order-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new as { id?: string; order_number?: string; status?: OrderStatus };
        if (!order.id || !order.status) return;
        const previousStatus = knownOrderStatusRef.current.get(order.id);
        knownOrderStatusRef.current.set(order.id, order.status);

        if (order.status === 'paid' && previousStatus !== 'paid') {
          notifyAdmin('새 주문이 들어왔어요! ☕', `${order.order_number ? formatOrderNumber(order.order_number) : '신규 주문'}을 확인해주세요.`);
        } else if (order.status === 'cancelled' && previousStatus !== 'cancelled') {
          notifyAdmin('주문이 자동 취소됐어요', `${order.order_number ? formatOrderNumber(order.order_number) : '주문'}의 결제 취소가 완료됐어요.`);
        }
        void loadOrders();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [accessDenied, loadOrders, session]);

  const scopedOrders = useMemo(() => dateScope === 'today' ? orders.filter((order) => isTodayInSeoul(order.created_at)) : orders, [dateScope, orders]);

  const visibleOrders = useMemo(() => scopedOrders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'active') return isActive(order.status);
    if (filter === 'new') return isNew(order.status);
    if (filter === 'completed') return order.status === 'picked_up';
    return order.status === filter;
  }), [filter, scopedOrders]);

  if (!isSupabaseConfigured) return <MessageScreen title="환경변수 설정이 필요해요" description="admin/.env.local 파일에 Supabase 공개 키를 넣어주세요." />;
  if (session === undefined) return <MessageScreen title="관리자 페이지 준비 중" description="로그인 정보를 확인하고 있어요." />;
  if (!session) return <AdminLogin />;
  if (accessDenied) return <AccessDenied email={session.user.email ?? ''} />;

  const activeCount = scopedOrders.filter((order) => isActive(order.status)).length;
  const todayOrders = orders.filter((order) => isTodayInSeoul(order.created_at));
  const todaySales = todayOrders.filter((order) => order.payment_status === 'paid').reduce((sum, order) => sum + order.total_amount, 0);
  const countFor = (key: Filter) => key === 'active' ? activeCount : key === 'new'
    ? scopedOrders.filter((order) => isNew(order.status)).length
    : key === 'completed' ? scopedOrders.filter((order) => order.status === 'picked_up').length
    : scopedOrders.filter((order) => order.status === key).length;

  const enableAdminAlerts = async () => {
    if (typeof Notification === 'undefined') {
      setError('이 브라우저에서는 알림을 지원하지 않아요. 최신 Chrome을 사용해주세요.');
      return;
    }
    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    window.localStorage.setItem('himnaegae-admin-alerts', enabled ? 'on' : 'off');
    alertsEnabledRef.current = enabled;
    setAlertsEnabled(enabled);
    if (enabled) {
      playAlertSound();
      setAlertToast({ title: '주문 알림을 켰어요', body: '새 주문과 취소 요청이 오면 소리로 알려드릴게요.' });
      window.setTimeout(() => setAlertToast(null), 4000);
    } else {
      setError('Chrome 주소창 왼쪽의 사이트 설정에서 알림을 허용해주세요.');
    }
  };

  const advanceOrder = async (orderId: string, currentStatus: OrderStatus, status: OrderStatus) => {
    setUpdatingId(orderId);
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .eq('status', currentStatus)
      .select('id')
      .maybeSingle();
    if (updateError) setError('주문 상태를 변경하지 못했어요.');
    else if (!updatedOrder) setError('고객 요청으로 주문 상태가 먼저 바뀌었어요. 새로고침 후 확인해주세요.');
    else {
      knownOrderStatusRef.current.set(orderId, status);
      const notificationStatuses: OrderStatus[] = [
        'paid', 'accepted', 'preparing', 'ready', 'picked_up',
      ];

      if (notificationStatuses.includes(status)) {
        const { error: notificationError } = await supabase.functions.invoke('send-order-notification', {
          body: { orderId },
        });

        if (notificationError) {
          setError('주문 상태는 변경됐지만 고객 알림 전송에 실패했어요.');
        }
      }
    }
    await loadOrders();
    setUpdatingId(null);
  };

  const requestAdvance = (order: AdminOrder) => {
    const next = nextStatus[order.status];
    if (!next) return;
    if (!window.confirm(`${formatOrderNumber(order.order_number)} 주문을 ‘${next.label}’ 상태로 변경할까요?`)) return;
    void advanceOrder(order.id, order.status, next.status);
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">🐾</span><div><strong>힘내개</strong><small>CAFE ADMIN</small></div></div>
        <nav aria-label="관리자 메뉴">
          <Link className="active" href="/"><span>▦</span><b>주문 관리</b><em>{activeCount}</em></Link>
          <Link href="/menu"><span>☕</span><b>메뉴 관리</b></Link><Link href="/members"><span>☺</span><b>회원 관리</b></Link><Link href="/settings"><span>⚙</span><b>매장 설정</b></Link>
        </nav>
        <div className="store-card"><span className="online-dot" /><div><strong>힘내개 본점</strong><small>{session.user.email}</small></div></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p className="overline">HIMNAEGAE COFFEE</p><h1>주문 관리</h1><p>주문과 픽업 시간을 한눈에 확인하세요.</p></div>
          <div className="header-actions"><button className={`alert-toggle ${alertsEnabled ? 'enabled' : ''}`} onClick={() => void enableAdminAlerts()}>{alertsEnabled ? '🔔 알림 켜짐' : '🔕 알림 켜기'}</button><div className="live-badge"><span className="online-dot" />실시간 주문 연결됨</div><button className="logout" onClick={() => void supabase.auth.signOut()}>로그아웃</button></div>
        </header>

        <section className="stats" aria-label="오늘의 주문 현황">
          <article><span className="stat-icon orange">▤</span><div><small>진행 중 주문</small><strong>{todayOrders.filter((order) => isActive(order.status)).length}건</strong><p>오늘 준비가 필요한 주문</p></div></article>
          <article><span className="stat-icon yellow">⌛</span><div><small>픽업 준비</small><strong>{todayOrders.filter((order) => order.status === 'ready').length}건</strong><p>고객을 기다리고 있어요</p></div></article>
          <article><span className="stat-icon green">₩</span><div><small>오늘 결제 주문 금액</small><strong>{won(todaySales)}</strong><p>결제 취소 주문 제외</p></div></article>
        </section>

        <section className="orders-panel">
          <div className="panel-head"><div><h2>실제 주문</h2><p>상태 버튼을 누르면 확인창을 거쳐 고객 앱과 알림센터에도 반영돼요.</p></div><div className="panel-tools"><div className="date-scope"><button className={dateScope === 'today' ? 'selected' : ''} onClick={() => setDateScope('today')}>오늘</button><button className={dateScope === 'all' ? 'selected' : ''} onClick={() => setDateScope('all')}>최근 100건</button></div><button className="refresh-button" onClick={() => void loadOrders()} disabled={loading}>↻ {loading ? '불러오는 중' : '새로고침'}</button></div></div>
          {error ? <div className="admin-error">{error}</div> : null}
          <div className="filters" role="tablist" aria-label="주문 상태 필터">
            {filters.map((item) => <button key={item.key} className={filter === item.key ? 'selected' : ''} onClick={() => setFilter(item.key)}>{item.label}{item.key !== 'all' ? <span>{countFor(item.key)}</span> : null}</button>)}
          </div>
          <div className="order-grid">
            {visibleOrders.length ? visibleOrders.map((order) => (
              <article className={`order-card ${statusTone(order.status)}`} key={order.id}>
                <div className="order-head"><div><strong>{formatOrderNumber(order.order_number)}</strong><span>{formatOrderTime(order.created_at)} 주문</span></div><span className={`status ${statusTone(order.status)}`}>{statusText[order.status]}</span></div>
                <div className={`pickup ${order.pickup_type === 'asap' ? 'asap' : ''}`}><span>⏰</span><div><small>고객 픽업 예정</small><strong>{formatPickup(order)}</strong></div></div>
                <div className="items">{order.order_items.map((item) => <div className="item" key={item.id}><div><strong>{item.menu_name} <b>× {item.quantity}</b></strong><span>{formatOptions(item)}</span></div></div>)}</div>
                {order.cancellation_reason ? <div className="cancel-reason"><strong>취소 사유</strong><span>{order.cancellation_reason}</span></div> : null}
                <div className="order-foot"><div><small>결제금액</small><strong>{won(order.total_amount)}</strong></div>{nextStatus[order.status] ? <button disabled={updatingId === order.id} onClick={() => requestAdvance(order)}>{updatingId === order.id ? '변경 중...' : nextStatus[order.status]!.label}<span>→</span></button> : <span className="completed">{statusText[order.status]}</span>}</div>
              </article>
            )) : <div className="empty-orders"><span>☕</span><strong>{loading ? '주문을 불러오는 중이에요' : '해당 주문이 없어요'}</strong><p>{loading ? '잠시만 기다려주세요.' : '다른 상태를 선택해보세요.'}</p></div>}
          </div>
        </section>
      </main>
      {alertToast ? <button className="order-alert-toast" onClick={() => setAlertToast(null)}><span>🔔</span><div><strong>{alertToast.title}</strong><p>{alertToast.body}</p></div></button> : null}
    </div>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage('이메일 또는 비밀번호를 확인해주세요.');
    setSubmitting(false);
  };

  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="login-brand">🐾</div><p>HIMNAEGAE CAFE</p><h1>관리자 로그인</h1><span>고객 앱에서 가입한 계정으로 로그인하세요.<br />최초 로그인 계정이 매장 관리자로 등록돼요.</span><label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message ? <div className="login-error">{message}</div> : null}<button disabled={submitting}>{submitting ? '확인 중...' : '관리자 페이지 들어가기'}</button></form></main>;
}

function AccessDenied({ email }: { email: string }) {
  return <main className="login-page"><div className="login-card denied"><div className="login-brand">🔒</div><h1>관리자 권한이 없어요</h1><span>{email}<br />최초 관리자에게 계정 등록을 요청해주세요.</span><button onClick={() => void supabase.auth.signOut()}>다른 계정으로 로그인</button></div></main>;
}

function MessageScreen({ title, description }: { title: string; description: string }) {
  return <main className="login-page"><div className="login-card denied"><div className="login-brand">🐾</div><h1>{title}</h1><span>{description}</span></div></main>;
}

function statusTone(status: OrderStatus) {
  if (status === 'paid' || status === 'accepted') return 'accepted';
  if (status === 'cancelled' || status === 'cancel_requested') return 'picked_up';
  if (status === 'payment_pending') return 'preparing';
  return status;
}

function formatOrderTime(value: string) { return new Date(value).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }); }
function formatPickup(order: AdminOrder) { if (order.pickup_type === 'asap') return '바로 픽업'; return order.pickup_at ? formatOrderTime(order.pickup_at) : '시간 미지정'; }
function formatOptions(item: OrderItem) { return [item.temperature, item.extra_shot_count > 0 && `샷 추가 × ${item.extra_shot_count}`, item.lightly && '연하게', item.soy_milk && '두유 변경', item.personal_tumbler && '개인 텀블러'].filter(Boolean).join(' · '); }
function formatOrderNumber(value: string) { const match = /^A-\d{8}-(\d+)$/.exec(value); return match ? `A-${match[1]}` : value; }
function isTodayInSeoul(value: string) {
  const orderDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return orderDay === today;
}

function playAlertSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (
      window as Window & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext;

    if (!AudioContextClass) return;
  
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.24, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    gain.connect(context.destination);
    [0, 0.2].forEach((delay, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = index === 0 ? 740 : 988;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.28);
    });
    window.setTimeout(() => void context.close(), 1000);
  } catch {
    // 브라우저가 소리를 막더라도 화면 알림은 계속 표시합니다.
  }
}
