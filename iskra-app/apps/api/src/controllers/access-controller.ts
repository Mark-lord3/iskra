import type { Request, Response } from "express";
import Stripe from "stripe";
import { Types } from "mongoose";
import { env } from "../config/env";
import { Event } from "../models/Event";
import { EventAccessPass } from "../models/EventAccessPass";
import { User } from "../models/User";
import { requireDatingApp } from "../lib/feature-config";

const usableSecret = (value: string, prefix: string) =>
  value.startsWith(prefix) && !value.includes("placeholder") && !value.includes("replace_me");

export const stripeCheckoutConfigured = () =>
  usableSecret(env.STRIPE_SECRET_KEY, "sk_test_") || usableSecret(env.STRIPE_SECRET_KEY, "sk_live_");

export const stripeWebhookConfigured = () => usableSecret(env.STRIPE_WEBHOOK_SECRET, "whsec_");

let stripeInstance: Stripe | null = null;
const stripeClient = () => {
  if (!stripeCheckoutConfigured()) {
    throw Object.assign(new Error("Secure checkout is temporarily unavailable. Please try again later."), { status: 503 });
  }
  stripeInstance ||= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeInstance;
};

async function activeEvent(eventId: string) {
  if (!Types.ObjectId.isValid(eventId)) return null;
  return Event.findOne({ _id: eventId, status: { $in: ["active", "ending"] }, endsAt: { $gt: new Date() } });
}

export async function getAccessStatus(req: Request, res: Response) {
  await requireDatingApp();
  const event = await activeEvent(String(req.params.eventId));
  if (!event) return res.status(404).json({ message: "This event is not active." });
  const pass = await EventAccessPass.findOneAndUpdate(
    { eventId: event._id, userId: req.auth!.userId },
    { $setOnInsert: { venueId: event.venueId, status: "pending", amountCents: 500, expiresAt: event.cleanupAt } },
    { upsert: true, new: true }
  ).lean();
  const registeredCount = await EventAccessPass.countDocuments({ eventId: event._id, status: { $in: ["pending", "paid"] } });
  res.json({ paid: pass?.status === "paid", status: pass?.status || "unpaid", amountCents: 500, registeredCount });
}

export async function createAccessCheckout(req: Request, res: Response) {
  await requireDatingApp();
  if (!stripeCheckoutConfigured()) return res.status(503).json({ message: "Secure checkout is temporarily unavailable. Please try again later." });
  const event = await activeEvent(String(req.params.eventId));
  if (!event) return res.status(404).json({ message: "This event is not active." });
  const user = await User.findById(req.auth!.userId);
  if (!user) return res.status(401).json({ message: "Account no longer exists." });
  const existing = await EventAccessPass.findOne({ eventId: event._id, userId: user._id });
  if (existing?.status === "paid") return res.json({ paid: true });

  if (existing?.stripeCheckoutSessionId) {
    try {
      const openSession = await stripeClient().checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
      if (openSession.status === "open" && openSession.url) return res.json({ url: openSession.url });
    } catch {
      // A missing or expired session is replaced below.
    }
  }

  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "cad",
        unit_amount: 500,
        product_data: { name: `${event.name} · ISKRA social room access` }
      }
    }],
    success_url: `${env.CLIENT_ORIGIN}/?access=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_ORIGIN}/?access=cancelled`,
    metadata: { kind: "event-access", userId: String(user._id), eventId: String(event._id) }
  });
  await EventAccessPass.findOneAndUpdate(
    { eventId: event._id, userId: user._id },
    { venueId: event.venueId, status: "pending", amountCents: 500, stripeCheckoutSessionId: session.id, expiresAt: event.cleanupAt },
    { upsert: true, new: true }
  );
  res.status(201).json({ url: session.url });
}

export async function completeAccessCheckout(req: Request, res: Response) {
  await requireDatingApp();
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId.startsWith("cs_")) return res.status(400).json({ message: "Invalid checkout session." });
  const session = await stripeClient().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.userId !== req.auth!.userId || session.metadata?.kind !== "event-access") {
    return res.status(403).json({ message: "This checkout does not belong to your account." });
  }
  if (session.payment_status !== "paid") return res.status(409).json({ message: "Payment has not completed." });
  await EventAccessPass.updateOne(
    { stripeCheckoutSessionId: session.id, userId: req.auth!.userId },
    { status: "paid", paidAt: new Date() }
  );
  res.json({ paid: true });
}

export async function stripeAccessWebhook(req: Request, res: Response) {
  if (!stripeWebhookConfigured()) return res.status(503).json({ message: "Stripe webhook is not configured." });
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(req.body, String(req.headers["stripe-signature"] || ""), env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send("Invalid Stripe signature.");
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.metadata?.kind === "event-access" && session.payment_status === "paid") {
      await EventAccessPass.updateOne({ stripeCheckoutSessionId: session.id }, { status: "paid", paidAt: new Date() });
    }
  }
  res.json({ received: true });
}
