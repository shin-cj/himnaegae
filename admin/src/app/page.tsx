const orders = [
  { id: '#A-024', time: '11:42', menu: '아메리카노 2 · 카페라떼 1', price: '14,200원', status: '신규 주문', tone: 'new' },
  { id: '#A-023', time: '11:38', menu: '딴기 크림 라떼 1', price: '5,900원', status: '제조 중', tone: 'making' },
  { id: '#A-022', time: '11:31', menu: '카페라떼 2', price: '10,400원', status: '픽업 준비', tone: 'ready' },
  { id: '#A-021', time: '11:20', menu: '아메리카노 1', price: '4,500원', status: '완료', tone: 'done' },
];

export default function Home() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">🐾</span>
          <div><strong>힘내개</strong><small>CAFE ADMIN</small></div>
        </div>
        <nav>
          <a className="active" href="#">▦ <span>대시보드</span></a>
          <a href="#">▤ <span>주문 관리</span><b>3</b></a>
          <a href="#">☕ <span>메뉴 관리</span></a>
          <a href="#">☺ <span>회원 관리</span></a>
          <a href="#">⚙ <span>매장 설정</span></a>
        </nav>
        <div className="store-card"><span className="online-dot" /><div><strong>힘내개 본점</strong><small>영업 중 · 21:00까지</small></div></div>
      </aside>

      <main className="main">
        <header>
          <div><p className="overline">2026년 8월 10일</p><h1>안녕하세요, 사장님!</h1><p>오늘 매장 현황을 확인해보세요.</p></div>
          <button className="open-button"><span className="online-dot" /> 주문 접수 중</button>
        </header>

        <section className="stats">
          <article><div className="stat-icon orange">₩</div><div><span>오늘 매출</span><strong>286,500원</strong><small className="up">↑ 12.5% 어제 대비</small></div></article>
          <article><div className="stat-icon cream">▤</div><div><span>오늘 주문</span><strong>47건</strong><small>3건 준비 중</small></div></article>
          <article><div className="stat-icon green">⌛</div><div><span>평균 준비 시간</span><strong>8분</strong><small className="up">↓ 2분 단축</small></div></article>
        </section>

        <section className="orders-panel">
          <div className="panel-title"><div><h2>실시간 주문</h2><p>새 주문과 제조 상태를 관리하세요.</p></div><button>전체 주문 보기 →</button></div>
          <div className="order-list">
            {orders.map((order) => (
              <article className="order" key={order.id}>
                <div className="order-id"><strong>{order.id}</strong><span>{order.time}</span></div>
                <div className="order-menu"><strong>{order.menu}</strong><span>픽업 주문</span></div>
                <strong className="price">{order.price}</strong>
                <span className={`status ${order.tone}`}>{order.status}</span>
                <button className="more">···</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
