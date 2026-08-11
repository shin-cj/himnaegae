'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

import type { AdminMenu } from '@/data/menu-data';
import { supabase } from '@/lib/supabase';

type MenuFormProps = { mode: 'create' | 'edit'; initialMenu?: AdminMenu };

const categories: Array<{ value: AdminMenu['category']; label: string }> = [
  { value: 'BEST_NEW', label: 'BEST & NEW' }, { value: 'COFFEE', label: 'COFFEE' },
  { value: 'LATTE', label: 'LATTE' }, { value: 'ADE', label: 'ADE' }, { value: 'TEA', label: 'TEA' },
];

export function MenuForm({ mode, initialMenu }: MenuFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialMenu?.name ?? '');
  const [description, setDescription] = useState(initialMenu?.description ?? '');
  const [price, setPrice] = useState(String(initialMenu?.price ?? ''));
  const [category, setCategory] = useState<AdminMenu['category']>(initialMenu?.category ?? 'COFFEE');
  const [temperature, setTemperature] = useState<AdminMenu['temperature']>(initialMenu?.temperature ?? 'BOTH');
  const [tag, setTag] = useState<AdminMenu['tag'] | ''>(initialMenu?.tag ?? '');
  const [emoji, setEmoji] = useState(initialMenu?.emoji ?? '☕');
  const [available, setAvailable] = useState(initialMenu?.available ?? true);
  const [sortOrder, setSortOrder] = useState(String(initialMenu?.sort_order ?? 999));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialMenu?.image_url ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError('JPG, PNG, WEBP, GIF 이미지만 올릴 수 있어요.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('이미지는 5MB 이하로 선택해주세요.'); return; }
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setImageFile(file); setPreviewUrl(URL.createObjectURL(file)); setRemoveImage(false); setError(null);
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `menus/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('menu-images').upload(path, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) throw new Error('이미지를 업로드하지 못했어요.');
    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
    return { path, url: data.publicUrl };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(null);
    let uploaded: { path: string; url: string } | null = null;
    try {
      const parsedPrice = Number(price);
      const parsedSortOrder = Number(sortOrder);
      if (!name.trim()) throw new Error('메뉴 이름을 입력해주세요.');
      if (!Number.isInteger(parsedPrice) || parsedPrice < 0) throw new Error('가격을 숫자로 입력해주세요.');
      if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) throw new Error('노출 순서를 0 이상의 숫자로 입력해주세요.');
      uploaded = await uploadImage();
      const values = {
        name: name.trim(), description: description.trim(), price: parsedPrice, category, temperature,
        tag: tag || null, emoji: emoji.trim() || '☕', available, sort_order: parsedSortOrder,
        image_url: uploaded?.url ?? (removeImage ? null : initialMenu?.image_url ?? null),
        image_path: uploaded?.path ?? (removeImage ? null : initialMenu?.image_path ?? null),
      };
      const result = mode === 'create'
        ? await supabase.from('menus').insert(values)
        : await supabase.from('menus').update(values).eq('id', initialMenu!.id);
      if (result.error) throw result.error;
      const previousPath = initialMenu?.image_path;
      if (previousPath && (uploaded || removeImage)) await supabase.storage.from('menu-images').remove([previousPath]);
      router.push('/menu'); router.refresh();
    } catch (submitError) {
      if (uploaded) await supabase.storage.from('menu-images').remove([uploaded.path]);
      setError(submitError instanceof Error ? submitError.message : '메뉴를 저장하지 못했어요.');
    } finally { setSubmitting(false); }
  };

  const deleteMenu = async () => {
    if (!initialMenu || !window.confirm(`${initialMenu.name} 메뉴를 삭제할까요?\n주문 기록은 유지되지만 고객 메뉴에서는 사라집니다.`)) return;
    setDeleting(true); setError(null);
    const { error: deleteError } = await supabase.from('menus').delete().eq('id', initialMenu.id);
    if (deleteError) setError('메뉴를 삭제하지 못했어요.');
    else {
      if (initialMenu.image_path) await supabase.storage.from('menu-images').remove([initialMenu.image_path]);
      router.push('/menu'); router.refresh();
    }
    setDeleting(false);
  };

  const clearImage = () => { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); setImageFile(null); setPreviewUrl(null); setRemoveImage(true); };

  return (
    <form className="menu-form" onSubmit={submit}>
      <section className="form-card image-form-card">
        <div className="form-card-title"><div><h2>메뉴 이미지</h2><p>정사각형 사진을 권장하며 최대 5MB까지 가능해요.</p></div></div>
        <div className="image-upload-row">
          <div className="image-preview">{previewUrl ? <Image src={previewUrl} alt="메뉴 미리보기" width={126} height={126} unoptimized /> : <span>{emoji || '☕'}</span>}</div>
          <div className="image-actions"><label className="upload-button">이미지 선택<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectImage} /></label>{previewUrl ? <button type="button" onClick={clearImage}>이미지 제거</button> : null}<small>JPG · PNG · WEBP · GIF</small></div>
        </div>
      </section>

      <section className="form-card">
        <div className="form-card-title"><div><h2>기본 정보</h2><p>고객 앱에 표시되는 메뉴 정보를 입력해주세요.</p></div></div>
        <div className="form-grid">
          <label className="field wide"><span>메뉴 이름 *</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required /></label>
          <label className="field"><span>가격 *</span><div className="price-input"><input type="number" min="0" step="100" value={price} onChange={(event) => setPrice(event.target.value)} required /><b>원</b></div></label>
          <label className="field"><span>이모지</span><input value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={4} /></label>
          <label className="field wide"><span>메뉴 설명</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} rows={4} /></label>
          <label className="field"><span>카테고리 *</span><select value={category} onChange={(event) => setCategory(event.target.value as AdminMenu['category'])}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="field"><span>제공 온도 *</span><select value={temperature} onChange={(event) => setTemperature(event.target.value as AdminMenu['temperature'])}><option value="BOTH">HOT · ICE</option><option value="HOT">HOT 전용</option><option value="ICE">ICE 전용</option></select></label>
          <label className="field"><span>메뉴 태그</span><select value={tag} onChange={(event) => setTag(event.target.value as AdminMenu['tag'] | '')}><option value="">태그 없음</option><option value="BEST">BEST</option><option value="NEW">NEW</option></select></label>
          <label className="field"><span>노출 순서</span><input type="number" min="0" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label>
        </div>
        <label className="availability-check"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /><span><b>판매 중으로 표시</b><small>끄면 고객 앱에서 메뉴가 숨겨지고 새 주문을 받을 수 없어요.</small></span></label>
      </section>

      {error ? <div className="form-error">{error}</div> : null}
      <div className="form-actions">{mode === 'edit' ? <button className="delete-menu" disabled={deleting || submitting} type="button" onClick={() => void deleteMenu()}>{deleting ? '삭제 중...' : '메뉴 삭제'}</button> : <span />}<div><Link href="/menu">취소</Link><button className="save-menu" disabled={submitting || deleting}>{submitting ? '저장 중...' : mode === 'create' ? '메뉴 추가' : '변경사항 저장'}</button></div></div>
    </form>
  );
}
