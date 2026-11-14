import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getRouterStatus, isRouterConfigured } from "./router.js";

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://skynetht-wifi.vercel.app";
const TRANZAK_API_URL = "https://api.tranzak.co/api/gateway/v1";

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function send(res, status, data, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
  });
  res.end(JSON.stringify(data));
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw new Error("Request body too large");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("Request body too large");
  }
  return raw ? JSON.parse(raw) : {};
}

function createTicketCode() {
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  return `SKY-${suffix.slice(0, 6)}-${suffix.slice(6)}`;
}

async function requireUser(req, res, origin, admin = false) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !supabase) {
    send(res, token ? 503 : 401, { error: token ? "API_NOT_CONFIGURED" : "UNAUTHORIZED" }, origin);
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    send(res, 401, { error: "INVALID_SESSION" }, origin);
    return null;
  }
  if (admin) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") {
      send(res, 403, { error: "ADMIN_REQUIRED" }, origin);
      return null;
    }
  }
  return user;
}

async function finalizeTranzakPayment(payment, providerPayment) {
  const transactionId = String(providerPayment?.transaction_id || "");
  const reference = String(providerPayment?.reference || "");
  const providerData = payment?.provider_payload || {};
  const amount = Number(providerPayment?.amount);
  const currency = String(providerPayment?.currency || "");
  const method = String(providerPayment?.payment_method || "");
  if (!payment || providerData.provider !== "tranzak"
      || transactionId !== String(payment.provider_reference || "")
      || reference !== String(payment.id)
      || !Number.isFinite(amount)
      || Math.round(amount * 100) !== Math.round(Number(providerData.amount) * 100)
      || currency !== String(providerData.currency)
      || method !== String(providerData.payment_method)) {
    throw new Error("TRANZAK_PAYMENT_MISMATCH");
  }

  if (providerPayment.status === "failed") {
    if (payment.status === "pending") {
      const { error } = await supabase.from("payments")
        .update({ status: "rejected", verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          provider_payload: { ...providerData, final_status: "failed", failure_reason: providerPayment.failure_reason || null } })
        .eq("id", payment.id).eq("status", "pending");
      if (error) throw error;
    }
    return { status: payment.status === "confirmed" ? "confirmed" : "rejected" };
  }

  if (providerPayment.status !== "completed") return { status: payment.status };
  const ticketCode = createTicketCode();
  const codeHash = createHash("sha256").update(ticketCode, "utf8").digest("hex");
  const { data: result, error } = await supabase.rpc("tranzak_confirm_wifi_payment", {
    p_payment_id: payment.id,
    p_transaction_id: transactionId,
    p_amount: amount,
    p_currency: currency,
    p_payment_method: method,
    p_code_hash: codeHash,
    p_router_username: ticketCode,
  });
  if (error) throw error;
  return { status: "confirmed", result: result?.result || "confirmed" };
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    send(res, 403, { error: "ORIGIN_NOT_ALLOWED" });
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, {
        status: "ok",
        service: "skynet-wifi-api",
        supabaseConfigured: Boolean(supabase),
        routerConfigured: isRouterConfigured(),
      }, origin);
      return;
    }
    if (req.method === "POST" && url.pathname === "/webhooks/tranzak") {
      const secret = process.env.TRANZAK_WEBHOOK_SECRET;
      if (!secret) { send(res, 503, { error: "TRANZAK_WEBHOOK_NOT_CONFIGURED" }); return; }
      const raw = await readRawBody(req);
      const signature = String(req.headers["x-tranzak-signature"] || "");
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      const valid = signature.length === expected.length
        && /^[a-f0-9]+$/i.test(signature)
        && timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
      if (!valid) { send(res, 403, { error: "INVALID_WEBHOOK_SIGNATURE" }); return; }
      const event = JSON.parse(raw.toString("utf8"));
      const headerEvent = String(req.headers["x-tranzak-event"] || "");
      if (!["payment.success", "payment.failed", "payment.refunded"].includes(event?.event)
          || (headerEvent && headerEvent !== event.event)
          || !event?.data?.transaction_id) {
        send(res, 400, { error: "INVALID_WEBHOOK_EVENT" }); return;
      }
      if (!supabase) { send(res, 503, { error: "BACKEND_CONFIGURATION_REQUIRED" }); return; }
      const { data: payment, error } = await supabase.from("payments")
        .select("id,status,plan_id,user_id,provider_reference,provider_payload")
        .eq("provider_reference", String(event.data.transaction_id))
        .maybeSingle();
      if (error) throw error;
      if (!payment) { send(res, 200, { received: true, ignored: true }); return; }
      if (event.event === "payment.success") {
        await finalizeTranzakPayment(payment, event.data);
      } else if (event.event === "payment.failed" && payment.status === "pending" && payment.provider_payload?.provider === "tranzak") {
        const { error: updateError } = await supabase.from("payments")
          .update({ status: "rejected", verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            provider_payload: { ...payment.provider_payload, final_status: "failed", failure_reason: event.data.failure_reason || null } })
          .eq("id", payment.id).eq("status", "pending");
        if (updateError) throw updateError;
      } else if (event.event === "payment.refunded" && payment.status === "confirmed" && payment.provider_payload?.payment_method === "card") {
        const { error: refundError } = await supabase.from("payments")
          .update({ status: "refunded", updated_at: new Date().toISOString(),
            provider_payload: { ...payment.provider_payload, final_status: "refunded" } })
          .eq("id", payment.id).eq("status", "confirmed");
        if (refundError) throw refundError;
      }
      send(res, 200, { received: true });
      return;
    }

    if (!supabase) {
      send(res, 503, { error: "BACKEND_CONFIGURATION_REQUIRED" }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/plans") {
      const { data, error } = await supabase
        .from("wifi_plans")
        .select("id,code,name,duration_seconds,price,currency,download_speed_mbps,upload_speed_mbps,starts_on_first_login")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      send(res, 200, { plans: data || [] }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const user = await requireUser(req, res, origin);
      if (!user) return;
      const { data: profile, error } = await supabase
        .from("profiles").select("id,full_name,phone,role,created_at").eq("id", user.id).maybeSingle();
      if (error) throw error;
      send(res, 200, { user: { id: user.id, email: user.email }, profile }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/my/records") {
      const user = await requireUser(req, res, origin);
      if (!user) return;
      const [paymentResult, ticketResult] = await Promise.all([
        supabase.from("payments")
          .select("id,amount,currency,payment_method,customer_phone,payment_reference,status,created_at,wifi_plans(name,code)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("wifi_tickets")
          .select("id,router_username,status,issued_at,activated_at,expires_at,created_at,wifi_plans(name,code,duration_seconds,starts_on_first_login)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (paymentResult.error) throw paymentResult.error;
      if (ticketResult.error) throw ticketResult.error;
      send(res, 200, { payments: paymentResult.data || [], tickets: ticketResult.data || [] }, origin);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/payments") {
      const user = await requireUser(req, res, origin);
      if (!user) return;
      const body = await readBody(req);
      const allowedMethods = ["cash", "moncash", "natcash", "card", "bank_transfer", "other"];
      if (!body.planId || !allowedMethods.includes(body.paymentMethod) || typeof body.customerPhone !== "string" || body.customerPhone.trim().length < 7) {
        send(res, 400, { error: "INVALID_PAYMENT_REQUEST" }, origin);
        return;
      }
      const { data: plan, error: planError } = await supabase
        .from("wifi_plans").select("id,price,currency,is_active,name").eq("id", body.planId).maybeSingle();
      if (planError) throw planError;
      if (!plan || !plan.is_active || plan.price == null || Number(plan.price) <= 0) {
        send(res, 409, { error: "PLAN_NOT_PURCHASABLE" }, origin);
        return;
      }

      const useTranzak = ["moncash", "natcash", "card"].includes(body.paymentMethod);
      if (useTranzak && (!process.env.TRANZAK_API_KEY || !process.env.TRANZAK_WEBHOOK_SECRET)) {
        send(res, 503, { error: "TRANZAK_NOT_CONFIGURED" }, origin);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      const customerName = profile?.full_name?.trim() || user.email?.split("@")[0] || "Client SkynetHT";
      const phoneDigits = body.customerPhone.replace(/\\D/g, "");
      const customerPhone = phoneDigits.length === 8 ? `+509${phoneDigits}`
        : phoneDigits.startsWith("509") && phoneDigits.length === 11 ? `+${phoneDigits}` : undefined;

      const { data: payment, error } = await supabase.from("payments").insert({
        user_id: user.id,
        plan_id: plan.id,
        amount: plan.price,
        currency: plan.currency,
        payment_method: body.paymentMethod,
        customer_phone: body.customerPhone.trim(),
        payment_reference: useTranzak ? null : (typeof body.paymentReference === "string" ? body.paymentReference.trim().slice(0, 120) : null),
        provider_payload: useTranzak ? { provider: "tranzak", state: "creating" } : {},
        status: "pending",
      }).select("id,amount,currency,payment_method,status,created_at").single();
      if (error) throw error;

      if (useTranzak) {
        let providerResponse;
        let providerBody = {};
        try {
          providerResponse = await fetch(`${TRANZAK_API_URL}/payments`, {
            method: "POST",
            headers: { "X-Api-Key": process.env.TRANZAK_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              amount: Number(plan.price),
              currency: plan.currency,
              payment_method: body.paymentMethod,
              customer_name: customerName,
              customer_email: user.email || undefined,
              customer_phone: customerPhone,
              reference: payment.id,
              description: `SkynetHT Wi-Fi - ${plan.name || "Forfait"}`,
              metadata: { payment_id: payment.id, user_id: user.id },
            }),
            signal: AbortSignal.timeout(15000),
          });
          providerBody = await providerResponse.json().catch(() => ({}));
          if (!providerResponse.ok || !providerBody.transaction_id || (body.paymentMethod === "card" ? (!providerBody.client_secret || !providerBody.publishable_key) : !providerBody.payment_url)) {
            throw new Error(providerBody.message || providerBody.error || `TRANZAK_HTTP_${providerResponse.status}`);
          }
          const paymentUrl = providerBody.payment_url ? new URL(providerBody.payment_url) : null;
          if (paymentUrl && paymentUrl.protocol !== "https:") throw new Error("INVALID_TRANZAK_PAYMENT_URL");
          const providerAmount = Number(providerBody.amount);
          if (!Number.isFinite(providerAmount) || !["HTG", "USD"].includes(providerBody.currency)) {
            throw new Error("INVALID_TRANZAK_RESPONSE");
          }
          const payload = {
            provider: "tranzak",
            reference: payment.id,
            transaction_id: String(providerBody.transaction_id),
            amount: String(providerBody.amount),
            currency: String(providerBody.currency),
            payment_method: body.paymentMethod,
            provider_status: String(providerBody.status || "processing"),
          };
          const { error: saveError } = await supabase.from("payments").update({
            provider_reference: String(providerBody.transaction_id),
            provider_payload: payload,
            updated_at: new Date().toISOString(),
          }).eq("id", payment.id).eq("status", "pending");
          if (saveError) throw saveError;
          send(res, 201, {
            payment, provider: "tranzak",
            ...(paymentUrl ? { paymentUrl: paymentUrl.toString() } : {}),
            ...(body.paymentMethod === "card" ? { cardSetup: {
              transactionId: String(providerBody.transaction_id),
              clientSecret: String(providerBody.client_secret),
              publishableKey: String(providerBody.publishable_key),
            } } : {}),
          }, origin);
          return;
        } catch (providerError) {
          await supabase.from("payments").update({
            status: "rejected", updated_at: new Date().toISOString(),
            provider_payload: { provider: "tranzak", state: "creation_failed", error: String(providerError?.message || "PROVIDER_ERROR").slice(0, 180) },
          }).eq("id", payment.id).eq("status", "pending");
          console.error("Tranzak payment creation failed:", providerError?.message || providerError);
          send(res, 502, { error: "TRANZAK_PAYMENT_CREATION_FAILED" }, origin);
          return;
        }
      }

      send(res, 201, { payment }, origin);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/payments/reconcile") {
      const user = await requireUser(req, res, origin);
      if (!user) return;
      if (!process.env.TRANZAK_API_KEY) { send(res, 503, { error: "TRANZAK_NOT_CONFIGURED" }, origin); return; }
      const body = await readBody(req);
      const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
      if (!/^\\d{6,30}$/.test(transactionId)) { send(res, 400, { error: "INVALID_TRANSACTION_ID" }, origin); return; }
      const { data: payment, error } = await supabase.from("payments")
        .select("id,status,plan_id,user_id,provider_reference,provider_payload")
        .eq("provider_reference", transactionId).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!payment || payment.provider_payload?.provider !== "tranzak") {
        send(res, 404, { error: "PAYMENT_NOT_FOUND" }, origin); return;
      }
      const providerResponse = await fetch(`${TRANZAK_API_URL}/payments/${encodeURIComponent(transactionId)}`, {
        headers: { "X-Api-Key": process.env.TRANZAK_API_KEY, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      const providerBody = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok || !providerBody.data) {
        send(res, 502, { error: "TRANZAK_STATUS_CHECK_FAILED" }, origin); return;
      }
      const result = await finalizeTranzakPayment(payment, providerBody.data);
      send(res, 200, { paymentId: payment.id, status: result.status }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/customers") {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const [{ data: profiles, error }, { data: authData, error: authError }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,phone,role,created_at").eq("role", "customer").order("created_at", { ascending: false }).limit(200),
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (error) throw error;
      if (authError) throw authError;
      const emails = new Map((authData.users || []).map((entry) => [entry.id, entry.email || null]));
      send(res, 200, { customers: (profiles || []).map((profile) => ({ ...profile, email: emails.get(profile.id) || null })) }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/plans") {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const { data, error } = await supabase.from("wifi_plans")
        .select("id,code,name,duration_seconds,price,currency,is_active,display_order,upload_speed_mbps,download_speed_mbps,starts_on_first_login")
        .order("display_order", { ascending: true });
      if (error) throw error;
      send(res, 200, { plans: data || [] }, origin);
      return;
    }

    const planUpdatePath = req.method === "PATCH"
      && url.pathname.startsWith("/api/admin/plans/");
    const planUpdateId = planUpdatePath
      ? url.pathname.slice("/api/admin/plans/".length)
      : "";
    const planUpdateMatch = planUpdateId && /^[0-9a-f-]{36}$/i.test(planUpdateId)
      ? [null, planUpdateId]
      : null;
    if (planUpdateMatch) {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const body = await readBody(req);
      const updates = {};
      if (Object.hasOwn(body, "price")) {
        if (body.price !== null && (!Number.isFinite(Number(body.price)) || Number(body.price) <= 0)) {
          send(res, 400, { error: "INVALID_PRICE" }, origin);
          return;
        }
        updates.price = body.price === null ? null : Number(body.price);
      }
      if (Object.hasOwn(body, "currency")) {
        if (!["HTG", "USD"].includes(body.currency)) {
          send(res, 400, { error: "INVALID_CURRENCY" }, origin);
          return;
        }
        updates.currency = body.currency;
      }
      if (Object.hasOwn(body, "isActive")) updates.is_active = Boolean(body.isActive);
      if (Object.hasOwn(body, "uploadSpeedMbps")) {
        const n = Number(body.uploadSpeedMbps);
        if (!Number.isFinite(n) || n <= 0) { send(res, 400, { error: "INVALID_SPEED" }, origin); return; }
        updates.upload_speed_mbps = n;
      }
      if (Object.hasOwn(body, "downloadSpeedMbps")) {
        const n = Number(body.downloadSpeedMbps);
        if (!Number.isFinite(n) || n <= 0) { send(res, 400, { error: "INVALID_SPEED" }, origin); return; }
        updates.download_speed_mbps = n;
      }
      if (!Object.keys(updates).length) {
        send(res, 400, { error: "NO_VALID_CHANGES" }, origin);
        return;
      }
      const { data, error } = await supabase.from("wifi_plans").update(updates)
        .eq("id", planUpdateMatch[1])
        .select("id,code,name,duration_seconds,price,currency,is_active,display_order,upload_speed_mbps,download_speed_mbps,starts_on_first_login")
        .single();
      if (error) throw error;
      await supabase.from("admin_audit_logs").insert({
        actor_id: user.id,
        action: "wifi_plan_updated",
        entity_type: "wifi_plan",
        entity_id: data.id,
        details: updates,
      });
      send(res, 200, { plan: data }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/summary") {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const [customers, pending, confirmed, activeTickets, tickets, plans] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("payments").select("amount,currency").eq("status", "confirmed"),
        supabase.from("wifi_tickets").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("wifi_tickets").select("id", { count: "exact", head: true }),
        supabase.from("wifi_plans").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      const failure = [customers, pending, confirmed, activeTickets, tickets, plans].find((item) => item.error);
      if (failure?.error) throw failure.error;
      const revenue = (confirmed.data || []).reduce((sum, payment) => {
        if (payment.currency === "HTG") sum.HTG += Number(payment.amount);
        else sum.USD += Number(payment.amount);
        return sum;
      }, { HTG: 0, USD: 0 });
      send(res, 200, {
        customers: customers.count || 0,
        pendingPayments: pending.count || 0,
        activeTickets: activeTickets.count || 0,
        totalTickets: tickets.count || 0,
        activePlans: plans.count || 0,
        revenue,
      }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/payments") {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const { data, error } = await supabase
        .from("payments")
        .select("id,amount,currency,payment_method,customer_phone,payment_reference,status,created_at, wifi_plans(name,code)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      send(res, 200, { payments: data || [] }, origin);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/tickets") {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const body = await readBody(req);
      const validUuid = (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
      if (!validUuid(body.planId) || (body.userId != null && !validUuid(body.userId))) {
        send(res, 400, { error: "INVALID_TICKET_REQUEST" }, origin);
        return;
      }
      const { data: plan, error: planError } = await supabase
        .from("wifi_plans")
        .select("id,name,code,duration_seconds,starts_on_first_login")
        .eq("id", body.planId)
        .eq("is_active", true)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan) {
        send(res, 409, { error: "ACTIVE_PLAN_NOT_FOUND" }, origin);
        return;
      }

      const ticketCode = createTicketCode();
      const codeHash = createHash("sha256").update(ticketCode, "utf8").digest("hex");
      const { data: result, error } = await supabase.rpc("admin_create_wifi_ticket", {
        p_plan_id: plan.id,
        p_admin_id: user.id,
        p_user_id: body.userId || null,
        p_code_hash: codeHash,
        p_router_username: ticketCode,
      });
      if (error) {
        if (error.message?.includes("ADMIN_REQUIRED")) {
          send(res, 403, { error: "ADMIN_REQUIRED" }, origin);
          return;
        }
        throw error;
      }
      send(res, 201, {
        ticket: { id: result.ticketId, code: ticketCode, status: "created", plan },
        message: "Ticket created. It will not provide internet until MikroTik is connected.",
      }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/tickets") {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const { data, error } = await supabase
        .from("wifi_tickets")
        .select("id,user_id,plan_id,payment_id,router_username,status,issued_at,activated_at,expires_at,created_at,wifi_plans(name,code,duration_seconds,starts_on_first_login)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      send(res, 200, { tickets: data || [] }, origin);
      return;
    }

    const ticketUpdatePath = req.method === "PATCH"
      && url.pathname.startsWith("/api/admin/tickets/");
    const ticketUpdateId = ticketUpdatePath
      ? url.pathname.slice("/api/admin/tickets/".length)
      : "";
    if (ticketUpdateId && /^[0-9a-f-]{36}$/i.test(ticketUpdateId)) {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const body = await readBody(req);
      if (!["created", "blocked", "revoked"].includes(body.status)) {
        send(res, 400, { error: "INVALID_TICKET_STATUS" }, origin);
        return;
      }
      const { data: ticket, error } = await supabase.from("wifi_tickets")
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq("id", ticketUpdateId)
        .select("id,status,router_username")
        .maybeSingle();
      if (error) throw error;
      if (!ticket) {
        send(res, 404, { error: "TICKET_NOT_FOUND" }, origin);
        return;
      }
      await supabase.from("admin_audit_logs").insert({
        actor_id: user.id,
        action: "wifi_ticket_status_changed",
        entity_type: "wifi_ticket",
        entity_id: ticket.id,
        details: { status: body.status },
      });
      send(res, 200, { ticket }, origin);
      return;
    }

    const confirmPaymentPath = req.method === "POST"
      && url.pathname.startsWith("/api/admin/payments/")
      && url.pathname.endsWith("/confirm");
    const confirmPaymentId = confirmPaymentPath
      ? url.pathname.slice("/api/admin/payments/".length, -"/confirm".length)
      : "";
    const confirmPaymentMatch = confirmPaymentId && /^[0-9a-f-]{36}$/i.test(confirmPaymentId)
      ? [null, confirmPaymentId]
      : null;
    if (confirmPaymentMatch) {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;

      const paymentId = confirmPaymentMatch[1];
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("id,status,plan_id,provider_payload,wifi_plans(name,code,duration_seconds,starts_on_first_login)")
        .eq("id", paymentId)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) {
        send(res, 404, { error: "PAYMENT_NOT_FOUND" }, origin);
        return;
      }
      if (payment.provider_payload?.provider === "tranzak") {
        send(res, 409, { error: "TRANZAK_PAYMENT_MUST_BE_CONFIRMED_BY_PROVIDER" }, origin);
        return;
      }
      if (payment.status !== "pending") {
        send(res, 409, { error: "PAYMENT_NOT_PENDING" }, origin);
        return;
      }

      const ticketCode = createTicketCode();
      const codeHash = createHash("sha256").update(ticketCode, "utf8").digest("hex");
      const { data: result, error } = await supabase.rpc("admin_confirm_wifi_payment", {
        p_payment_id: paymentId,
        p_admin_id: user.id,
        p_code_hash: codeHash,
        p_router_username: ticketCode,
      });
      if (error) {
        if (error.message?.includes("PAYMENT_NOT_PENDING")) {
          send(res, 409, { error: "PAYMENT_NOT_PENDING" }, origin);
          return;
        }
        if (error.message?.includes("ADMIN_REQUIRED")) {
          send(res, 403, { error: "ADMIN_REQUIRED" }, origin);
          return;
        }
        throw error;
      }
      if (result?.result !== "confirmed") {
        send(res, 409, { error: "PAYMENT_ALREADY_PROCESSED" }, origin);
        return;
      }

      send(res, 200, {
        paymentId,
        status: "confirmed",
        ticket: {
          id: result.ticketId,
          code: ticketCode,
          status: "created",
          plan: payment.wifi_plans,
        },
        message: "Payment confirmed. Ticket created; router activation is not enabled yet.",
      }, origin);
      return;
    }

    const rejectPaymentPath = req.method === "POST"
      && url.pathname.startsWith("/api/admin/payments/")
      && url.pathname.endsWith("/reject");
    const rejectPaymentId = rejectPaymentPath
      ? url.pathname.slice("/api/admin/payments/".length, -"/reject".length)
      : "";
    if (rejectPaymentId && /^[0-9a-f-]{36}$/i.test(rejectPaymentId)) {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const { data: targetPayment, error: targetPaymentError } = await supabase
        .from("payments").select("provider_payload").eq("id", rejectPaymentId).maybeSingle();
      if (targetPaymentError) throw targetPaymentError;
      if (targetPayment?.provider_payload?.provider === "tranzak") {
        send(res, 409, { error: "TRANZAK_PAYMENT_STATUS_IS_MANAGED_AUTOMATICALLY" }, origin);
        return;
      }
      const { data: result, error } = await supabase.rpc("admin_reject_wifi_payment", {
        p_payment_id: rejectPaymentId,
        p_admin_id: user.id,
      });
      if (error) {
        if (error.message?.includes("PAYMENT_NOT_PENDING")) {
          send(res, 409, { error: "PAYMENT_NOT_PENDING" }, origin);
          return;
        }
        if (error.message?.includes("PAYMENT_NOT_FOUND")) {
          send(res, 404, { error: "PAYMENT_NOT_FOUND" }, origin);
          return;
        }
        if (error.message?.includes("ADMIN_REQUIRED")) {
          send(res, 403, { error: "ADMIN_REQUIRED" }, origin);
          return;
        }
        throw error;
      }
      send(res, 200, { paymentId: rejectPaymentId, status: "rejected", result: result?.result }, origin);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/router/status") {
      const user = await requireUser(req, res, origin, true);
      if (!user) return;
      const status = await getRouterStatus();
      send(res, status.connected || !status.configured ? 200 : 503, status, origin);
      return;
    }

    send(res, 404, { error: "NOT_FOUND" }, origin);
  } catch (error) {
    console.error("API request failed:", error?.message || error);
    send(res, 500, { error: "INTERNAL_SERVER_ERROR" }, origin);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Skynet Wi-Fi API listening on port ${PORT}`);
});
