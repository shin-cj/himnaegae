const letterPattern = /[A-Za-z]/;
const numberPattern = /[0-9]/;
const symbolPattern = /[^A-Za-z0-9\s]/;

export function getPasswordValidationError(password: string) {
  if (password.length < 10) return '비밀번호는 10글자 이상 입력해주세요.';
  if (password.length > 72) return '비밀번호는 72글자 이하로 입력해주세요.';
  if (/\s/.test(password)) return '비밀번호에는 공백을 사용할 수 없어요.';

  const characterGroupCount = [letterPattern, numberPattern, symbolPattern]
    .filter((pattern) => pattern.test(password)).length;
  if (characterGroupCount < 2) {
    return '영문, 숫자, 특수문자 중 2종류 이상을 함께 사용해주세요.';
  }
  return null;
}
