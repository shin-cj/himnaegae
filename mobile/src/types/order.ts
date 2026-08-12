export type OrderStatus =
  | 'payment_pending'
  | 'paid'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancel_requested'
  | 'cancelled';

export type OrderItem = {
  id: number;
  menu_name: string;
  temperature: 'HOT' | 'ICE';
  extra_shot: boolean;
  extra_shot_count: number;
  soy_milk: boolean;
  personal_tumbler: boolean;
  quantity: number;
  unit_price: number;
  line_total: number;
  lightly : boolean;
};

export type Order = {
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
