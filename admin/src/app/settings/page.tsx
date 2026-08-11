'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type BusinessStatus = 'open' | 'paused' | 'closed';
type StoreSettings = {
  id: number;
  store_name: string;
  business_status: BusinessStatus;
  notice: string;
  phone: string;
  address: string;
  open_time: string;
  close_time: string;
  pickup_min: number;
  pickup_max: number;
  pickup_guide: string;
};

const defaults: StoreSettings = {
  id: 1, store_name: '힘내개 본점', business_status: 'open', notice: '', phone: '', address: '',
  open_time: '09:00', close_time: '20:00', pickup_min: 10, pickup_max: 15,
  pickup_guide: '준비가 끝나면 알림을 보내드려요.',
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { router.replace('/'); return; }
    const { error: accessError } = await supabase.rpc('claim_first_admin');
    if (accessError) { setError('관리자 권한이 없어요.'); setLoading(false); return; }
    const { data, error: queryError } = await supabase.from('store_settings').select('*').eq('id', 1).single();
    if (queryError) setError('매장 설정을 불러오지 못했어요.');
    else { setSettings({ ...data, open_time: data.open_time.slice(0, 5), close_time: data.close_time.slice(0, 5) } as StoreSettings); setError(null); }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  const update = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    if (!settings.store_name.trim()) { setError('매장명을 입력해주세요.'); setSaving(false); return; }
    if (settings.pickup_max < settings.pickup_min) { setError('최대 픽업 시간은 최소 시간보다 작을 수 없어요.'); setSaving(false); return; }
    const { error: updateError } = await supabase.from('store_settings').update({
      store_name: settings.store_name.trim(), business_status: settings.business_status, notice: settings.notice.trim(),
      phone: settings.phone.trim(), address: settings.address.trim(), open_time: settings.open_time,
      close_time: settings.close_time, pickup_min: settings.pickup_min, pickup_max: settings.pickup_max,
      pickup_guide: settings.pickup_guide.trim(),
    }).eq('id', 1);
    if (updateError) setError('매장 설정을 저장하지 못했어요.'); else setMessage('저장했어요. 고객 앱에도 바로 반영됩니다.');
    setSaving(false);
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">🐾</span><div><strong>힘내개</strong><small>CAFE ADMIN</small></div></div>
        <nav aria-label="관리자 메뉴">
          <Link href="/"><span>▦</span><b>주문 관리</b></Link>
          <Link href="/menu"><span>☕</span><b>메뉴 관리</b></Link>
          <Link href="/members"><span>☺</span><b>회원 관리</b></Link>
          <Link className="active" href="/settings"><span>⚙</span><b>매장 설정</b></Link>
        </nav>
        <div className="store-card"><span className={`online-dot ${settings.business_status}`} /><div><strong>{settings.store_name}</strong><small>{settings.business_status === 'open' ? '현재 주문 가능' : '현재 주문 중지'}</small></div></div>
      </aside>

      <main className="main settings-main">
        <header className="topbar"><div><p className="overline">STORE SETTINGS</p><h1>매장 설정</h1><p>고객 앱에 표시되는 운영 정보를 관리하세요.</p></div></header>
        {loading ? <div className="form-message">매장 설정을 불러오는 중이에요</div> : (
          <form className="settings-form" onSubmit={save}>
            <section className="form-card">
              <div className="form-card-title"><div><h2>영업 상태</h2><p>선택한 상태는 고객 앱에 바로 표시됩니다.</p></div></div>
              <div className="status-options">
                {([{ key: 'open', title: '영업 중', description: '고객 주문을 정상적으로 받습니다.' }, { key: 'paused', title: '주문 잠시 중지', description: '혼잡할 때 새 주문을 잠시 막습니다.' }, { key: 'closed', title: '영업 종료', description: '오늘 주문 접수를 종료합니다.' }] as const).map((item) => (
                  <button type="button" key={item.key} className={settings.business_status === item.key ? `selected ${item.key}` : ''} onClick={() => update('business_status', item.key)}><span /><strong>{item.title}</strong><small>{item.description}</small></button>
                ))}
              </div>
            </section>

            <section className="form-card">
              <div className="form-card-title"><div><h2>매장 기본 정보</h2><p>고객이 매장을 확인할 때 필요한 정보예요.</p></div></div>
              <div className="form-grid">
                <label className="field"><span>매장명 *</span><input value={settings.store_name} onChange={(event) => update('store_name', event.target.value)} maxLength={40} required /></label>
                <label className="field"><span>전화번호</span><input value={settings.phone} onChange={(event) => update('phone', event.target.value)} placeholder="02-0000-0000" maxLength={30} /></label>
                <label className="field wide"><span>주소</span><input value={settings.address} onChange={(event) => update('address', event.target.value)} placeholder="매장 주소를 입력해주세요" maxLength={120} /></label>
                <label className="field"><span>영업 시작</span><input type="time" value={settings.open_time} onChange={(event) => update('open_time', event.target.value)} /></label>
                <label className="field"><span>영업 종료</span><input type="time" value={settings.close_time} onChange={(event) => update('close_time', event.target.value)} /></label>
              </div>
            </section>

            <section className="form-card">
              <div className="form-card-title"><div><h2>픽업 안내</h2><p>고객 홈과 장바구니에 보여줄 예상 시간을 설정하세요.</p></div></div>
              <div className="form-grid">
                <label className="field"><span>최소 예상 시간</span><div className="price-input"><input type="number" min="1" max="120" value={settings.pickup_min} onChange={(event) => update('pickup_min', Number(event.target.value))} /><b>분</b></div></label>
                <label className="field"><span>최대 예상 시간</span><div className="price-input"><input type="number" min="1" max="180" value={settings.pickup_max} onChange={(event) => update('pickup_max', Number(event.target.value))} /><b>분</b></div></label>
                <label className="field wide"><span>픽업 안내 문구</span><input value={settings.pickup_guide} onChange={(event) => update('pickup_guide', event.target.value)} maxLength={100} /></label>
                <label className="field wide"><span>고객 공지</span><textarea value={settings.notice} onChange={(event) => update('notice', event.target.value)} placeholder="공지할 내용이 있을 때 입력해주세요" maxLength={200} rows={4} /></label>
              </div>
            </section>

            {error ? <div className="form-error">{error}</div> : null}
            {message ? <div className="form-success">{message}</div> : null}
            <div className="settings-save"><button className="save-menu" disabled={saving}>{saving ? '저장 중...' : '매장 설정 저장'}</button></div>
          </form>
        )}
      </main>
    </div>
  );
}
