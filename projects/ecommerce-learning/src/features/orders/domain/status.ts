export const transitions: Record<string, readonly string[]> = {
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['refunded'],
  refunded: [],
  cancelled: []
};
export function canTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
