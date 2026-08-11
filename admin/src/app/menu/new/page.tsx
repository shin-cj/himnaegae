import Link from 'next/link';

import { MenuForm } from '@/components/MenuForm';

export default function NewMenuPage() {
  return <main className="form-page"><div className="form-page-head"><Link href="/menu" aria-label="메뉴 관리로 돌아가기">‹</Link><div className="form-head-copy"><p>메뉴 관리</p><h1>새 메뉴 추가</h1><span>메뉴 정보와 이미지를 입력하면 고객 앱에 바로 추가됩니다.</span></div></div><MenuForm mode="create" /></main>;
}
