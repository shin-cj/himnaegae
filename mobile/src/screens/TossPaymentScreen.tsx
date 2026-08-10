import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

export type TossPaymentSession = {
  clientKey: string;
  orderId: string;
  orderNumber?: number | string;
  amount: number;
  orderName: string;
  customerEmail: string;
  pickupLabel: string;
  successUrl: string;
  failUrl: string;
};

type Props = {
  session: TossPaymentSession;
  onClose: () => void;
  onSuccess: (payment: { paymentKey: string; orderId: string; amount: number }) => void;
  onFail: (message: string) => void;
};

export function TossPaymentScreen({ session, onClose, onSuccess, onFail }: Props) {
  const html = useMemo(() => {
    const values = JSON.stringify(session).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="ko">
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <script src="https://js.tosspayments.com/v2/standard"></script>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#fff9ee;color:#2b211d;margin:0;padding:24px;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{width:100%;max-width:500px;margin:0 auto;background:#fff;border-radius:24px;padding:24px;box-shadow:0 8px 30px #5b33151a;transform:translateY(22px)}
    .brand{color:#f26b3a;font-weight:900;font-size:14px}.amount{font-size:30px;font-weight:900;margin:10px 0}.name{color:#74665e}.pickup{display:inline-block;margin:12px 0 26px;padding:8px 12px;border-radius:12px;background:#fff0e9;color:#f26b3a;font-size:13px;font-weight:800}
    button{width:100%;border:0;border-radius:16px;padding:18px;background:#f26b3a;color:#fff;font-size:17px;font-weight:900}
    .note{text-align:center;color:#9a8b82;font-size:13px;margin-top:16px;line-height:1.5}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">힘내개 테스트 결제</div>
    <div class="amount">${session.amount.toLocaleString('ko-KR')}원</div>
    <div class="name">${session.orderName}</div>
    <div class="pickup">${session.pickupLabel}</div>
    <button id="pay">결제수단 선택하기</button>
    <div class="note">테스트 키를 사용하므로 실제 돈은 결제되지 않아요.</div>
  </div>
  <script>
    const v=${values};
    document.querySelector('#pay').onclick=async()=>{
      try {
        const toss=TossPayments(v.clientKey);
        const payment=toss.payment({customerKey:'customer_'+v.orderId.replaceAll('-','')});
        await payment.requestPayment({
          method:'CARD', amount:{currency:'KRW',value:v.amount}, orderId:v.orderId,
          orderName:v.orderName, successUrl:v.successUrl, failUrl:v.failUrl,
          customerEmail:v.customerEmail, customerName:'힘내개 손님', windowTarget:'self'
        });
      } catch(e) { alert(e.message||'결제창을 열지 못했어요.'); }
    };
  </script>
</body>
</html>`;
  }, [session]);

  const shouldLoad = (request: WebViewNavigation) => {
    if (request.url.startsWith(session.successUrl)) {
      const callback = new URL(request.url);
      const paymentKey = callback.searchParams.get('paymentKey');
      const orderId = callback.searchParams.get('orderId');
      const amount = Number(callback.searchParams.get('amount'));
      if (paymentKey && orderId && Number.isInteger(amount)) onSuccess({ paymentKey, orderId, amount });
      else onFail('결제 결과를 확인할 수 없어요.');
      return false;
    }
    if (request.url.startsWith(session.failUrl)) {
      const callback = new URL(request.url);
      onFail(callback.searchParams.get('message') ?? '결제가 취소됐어요.');
      return false;
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} hitSlop={12}><Text style={styles.close}>‹</Text></Pressable>
        <Text style={styles.title}>테스트 결제</Text>
        <View style={styles.spacer} />
      </View>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        onShouldStartLoadWithRequest={shouldLoad}
        style={styles.webView}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff9ee' },
  header: { height: 68, paddingTop: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee4da' },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  close: { color: '#74665e', fontSize: 32, lineHeight: 34, fontWeight: '500' },
  title: { flex: 1, textAlign: 'center', color: '#2b211d', fontSize: 17, fontWeight: '900' },
  spacer: { width: 40 },
  webView: { flex: 1, backgroundColor: '#fff9ee' },
});
