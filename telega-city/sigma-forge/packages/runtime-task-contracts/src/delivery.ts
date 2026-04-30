export interface TaskDeliveryEnvelope {
  delivery_id: string;
  task_id: string;
  tele_user_id: string;
  target: string;
  status: "pending" | "sent" | "failed";
  payload_summary: string;
  payload_ref?: string;
  created_at: string;
}
