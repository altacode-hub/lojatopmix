export const createPayment = async (total: number) => {
  return { status: 'pending', amount: total }
}
