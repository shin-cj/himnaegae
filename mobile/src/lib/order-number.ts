export function formatOrderNumber(orderNumber: string) {
  const dailyNumber = /^A-\d{8}-(\d+)$/.exec(orderNumber);
  return dailyNumber ? `A-${dailyNumber[1]}` : orderNumber;
}
