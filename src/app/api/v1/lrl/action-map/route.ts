import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user_id = url.searchParams.get("user_id") || "";
  if (!user_id) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const ledger = db.lrl.listLedger({ user_id, limit: 1 });
  if (!ledger.length) {
    return NextResponse.json({ ok: true, action_map: null });
  }

  const last = ledger[0];
  const event = db.lrl.getEvent(last.event_id);
  const payload = event?.payload_json ? safeJson(event.payload_json) : {};

  const map = resolveActionMap(last.reason, payload);
  return NextResponse.json({ ok: true, action_map: map });
}

function resolveActionMap(reason: string, payload: any) {
  if (reason === "review.left") {
    const stars = Number(payload?.stars ?? payload?.rating ?? 0);
    if (stars <= 3) {
      return {
        id: "am_review_support_v1",
        channel: "studio",
        title: "Нужна помощь",
        body: "Нам важно исправить ситуацию. Свяжемся и предложим решение.",
        ctas: [
          { label: "Связаться", action: "lrl.open_support", params: {} },
          { label: "Описать проблему", action: "lrl.add_context", params: {} },
        ],
        deeplink: "/reviews",
        expires_sec: 86400,
      };
    }
    return {
      id: "am_review_thanks_v1",
      channel: "studio",
      title: "Спасибо за отзыв!",
      body: "Хотите бонус за фото или короткий текст?",
      ctas: [
        { label: "Получить бонус", action: "lrl.claim_bonus", params: { kind: "photo_proof" } },
        { label: "Поделиться", action: "share", params: { target: "story" } },
      ],
      deeplink: "/reviews",
      expires_sec: 86400,
    };
  }

  if (reason === "order.paid") {
    return {
      id: "am_order_thanks_v1",
      channel: "studio",
      title: "Заказ оплачен",
      body: "Хотите ускорить доставку или добавить опцию?",
      ctas: [
        { label: "Ускорить", action: "lrl.upsell", params: { kind: "fast_delivery" } },
      ],
      deeplink: "/orders",
      expires_sec: 86400,
    };
  }

  if (reason === "service.booked") {
    return {
      id: "am_booking_followup_v1",
      channel: "studio",
      title: "Бронирование подтверждено",
      body: "Хотите добавить напоминание или уточнить детали?",
      ctas: [
        { label: "Напоминание", action: "lrl.add_reminder", params: {} },
      ],
      deeplink: "/bookings",
      expires_sec: 86400,
    };
  }

  return null;
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
