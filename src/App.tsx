import { useEffect, useMemo, useState } from "react";

import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import {
  ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Clock3,
  CreditCard, Download, Gauge, Globe2, LayoutDashboard, LockKeyhole,
  LogOut, Menu, Plus, Radio, RefreshCw, Search, Settings, ShieldCheck,
  Signal, Ticket, Users, UserRound, ClipboardList, FileText, KeyRound, Wallet, Wifi, X, Zap, Ban, Printer,
} from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL || "https://skynetht-wifi-api.onrender.com").replace(/\/$/, "");
const AUTH_REDIRECT_URL = "https://skynetht-wifi.vercel.app";
type Section = "overview" | "customers" | "tickets" | "payments" | "plans" | "benefits" | "reports" | "settings";
type Plan = {
  id: string; code: string; name: string; duration_seconds: number;
  price: number | null; currency: "HTG" | "USD"; is_active: boolean;
  display_order: number; upload_speed_mbps?: number | null;
  download_speed_mbps?: number | null; starts_on_first_login: boolean;
};
type Profile = { id: string; full_name: string | null; phone: string | null; role: string; email?: string | null; created_at?: string };
type Payment = {
  id: string; user_id?: string | null; amount: number; currency: string;
  payment_method: string; customer_phone: string | null; payment_reference: string | null;
  customer_name?: string | null; customer_email?: string | null; customer_reference?: string | null; provider_reference?: string | null;
  status: string; created_at: string; provider_payload?: { provider?: string } | null; wifi_plans?: { name: string; code: string } | null;
};
type WifiTicket = {
  id: string; user_id: string | null; plan_id: string; payment_id: string | null;
  router_username: string | null; status: string; issued_at: string;
  activated_at: string | null; expires_at: string | null; created_at: string;
  wifi_plans?: { name: string; code: string; duration_seconds: number; starts_on_first_login: boolean } | null;
};
type Summary = {
  customers: number; pendingPayments: number; activeTickets: number;
  totalTickets: number; activePlans: number; revenue: { HTG: number; USD: number };
};
type ApiError = Error & { status?: number };

const sections: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { id: "customers", label: "Clients", icon: Users },
  { id: "tickets", label: "Tickets Wi-Fi", icon: Ticket },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "plans", label: "Forfaits", icon: Wallet },
  { id: "benefits", label: "Rabais & avis", icon: Users },
  { id: "reports", label: "Rapports", icon: FileText },
  { id: "settings", label: "Paramètres", icon: Settings },
];

function formatDuration(seconds: number) {
  if (seconds % 2592000 === 0) return `${seconds / 2592000} mois`;
  if (seconds % 86400 === 0) return `${seconds / 86400} jour${seconds / 86400 > 1 ? "s" : ""}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} heure${seconds / 3600 > 1 ? "s" : ""}`;
  return `${Math.round(seconds / 60)} minutes`;
}
function money(amount: number | null, currency = "HTG") {
  if (amount == null) return "Prix non défini";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(amount));
}
function date(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function statusLabel(status: string) {
  return ({ pending: "En attente", confirmed: "Confirmé", rejected: "Refusé", refunded: "Remboursé", created: "Créé", active: "Actif", expired: "Expiré", blocked: "Bloqué", revoked: "Révoqué" } as Record<string, string>)[status] || status;
}
function paymentLabel(method: string) {
  return ({ cash: "Espèces", moncash: "MonCash", natcash: "NatCash", card: "Carte désactivée", bank_transfer: "Virement bancaire", other: "Autre" } as Record<string, string>)[method] || method;
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Erreur API (${response.status})`) as ApiError;
    error.status = response.status;
    throw error;
  }
  return body as T;
}
function Brand() {
  return <a href="/" className="brand" aria-label="Retour à l’accueil"><img src="data:image/webp;base64,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" alt="Skynet WiFi" /></a>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"customer" | "admin">(() => window.location.pathname.replace(/\/$/, "") === "/admin" ? "admin" : "customer");
  const [section, setSection] = useState<Section>("overview");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<"customer" | "admin">("customer");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [signupConfirmationEmail, setSignupConfirmationEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("moncash");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<WifiTicket[]>([]);
  const [myPayments, setMyPayments] = useState<Payment[]>([]);
  const [myTickets, setMyTickets] = useState<WifiTicket[]>([]);
  const [adminPlans, setAdminPlans] = useState<Plan[]>([]);
  const [ticketPlanId, setTicketPlanId] = useState("");
  const [ticketCustomerId, setTicketCustomerId] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [apiHealth, setApiHealth] = useState<"checking" | "online" | "offline">("checking");
  const [routerStatus, setRouterStatus] = useState("Non configuré");
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerView, setCustomerView] = useState<"home" | "account" | "tickets" | "requests">("home");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [customerDiscount, setCustomerDiscount] = useState({ percent: 0, source: "none" });
  const [customerNotices, setCustomerNotices] = useState<{id:string;reason:string;created_at:string}[]>([]);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profilePhoneDraft, setProfilePhoneDraft] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState("0");
  const [individualDiscounts, setIndividualDiscounts] = useState<{user_id:string;percent:number;enabled:boolean}[]>([]);
  const [serviceNotices, setServiceNotices] = useState<{id:string;scope:string;user_id:string|null;reason:string;active:boolean;created_at:string}[]>([]);
  const [benefitCustomerId, setBenefitCustomerId] = useState("");
  const [individualDiscountPercent, setIndividualDiscountPercent] = useState("0");
  const [noticeScope, setNoticeScope] = useState<"global"|"individual">("global");
  const [noticeCustomerId, setNoticeCustomerId] = useState("");
  const [noticeReason, setNoticeReason] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportPreviewReady, setReportPreviewReady] = useState(false);

  const notify = (message: string) => { setNotice(message); setError(""); };
  const fail = (message: string) => { setError(message); setNotice(""); };

  useEffect(() => {
    let alive = true;
    if (!window.history.state?.skynetWifiView) window.history.replaceState({ ...(window.history.state || {}), skynetWifiView: "home" }, "", window.location.href);
    const handleCustomerPopState = (event: PopStateEvent) => {
      const view = event.state?.skynetWifiView;
      if (view === "home" || view === "account" || view === "tickets" || view === "requests") {
        setCustomerView(view);
        setCustomerMenuOpen(false);
      } else {
        setCustomerView("home");
        setCustomerMenuOpen(false);
      }
    };
    window.addEventListener("popstate", handleCustomerPopState);
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { setProfile(null); setMode("customer"); }
    });
    fetch(`${API_URL}/health`).then((r) => r.ok ? r.json() : Promise.reject()).then(() => alive && setApiHealth("online")).catch(() => alive && setApiHealth("offline"));
    return () => { alive = false; listener.subscription.unsubscribe(); window.removeEventListener("popstate", handleCustomerPopState); };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadProfile() {
      if (!session) { setProfile(null); return; }
      try {
        const result = await api<{ user: { id: string; email: string }; profile: Profile | null; discount?: {percent:number;source:string}; notices?: {id:string;reason:string;created_at:string}[] }>("/api/me");
        if (alive) {
          const nextProfile = { ...(result.profile || { id: result.user.id, full_name: null, phone: null, role: "customer" }), email: result.user.email };
          setProfile(nextProfile); setProfileNameDraft(nextProfile.full_name || ""); setProfilePhoneDraft(nextProfile.phone || "");
          setCustomerDiscount(result.discount || {percent:0,source:"none"}); setCustomerNotices(result.notices || []);
        }
      } catch (e) {
        if (alive) fail((e as Error).message);
      }
    }
    loadProfile();
    return () => { alive = false; };
  }, [session?.access_token]);

  const loadPlans = async () => {
    setCatalogLoading(true);
    setCatalogError("");
    if (!isSupabaseConfigured) {
      setCatalogError("La connexion Supabase n’est pas configurée.");
      setCatalogLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase.from("wifi_plans")
      .select("id,code,name,duration_seconds,price,currency,is_active,display_order,upload_speed_mbps,download_speed_mbps,starts_on_first_login")
      .eq("is_active", true).order("display_order", { ascending: true });
    if (loadError) setCatalogError(loadError.message);
    else {
      const rows = (data || []) as Plan[];
      setPlans(rows);
      if (!selectedPlan || !rows.some((p) => p.id === selectedPlan)) setSelectedPlan(rows[0]?.id || "");
    }
    setCatalogLoading(false);
  };
  useEffect(() => { loadPlans(); }, []);

  const loadMyRecords = async () => {
    if (!session) { setMyPayments([]); setMyTickets([]); return; }
    try {
      const records = await api<{ payments: Payment[]; tickets: WifiTicket[] }>("/api/my/records");
      setMyPayments(records.payments);
      setMyTickets(records.tickets);
    } catch (e) { fail((e as Error).message); }
  };
  useEffect(() => {
    if (mode === "customer" && session) loadMyRecords();
  }, [session?.access_token, mode]);

  useEffect(() => {
    if (!session?.access_token) return;
    const params = new URLSearchParams(window.location.search);
    const transactionId = params.get("transaction_id");
    if (!transactionId) return;
    let alive = true;
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    api<{ paymentId: string; status: string }>("/api/payments/reconcile", {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    }).then(async (result) => {
      if (!alive) return;
      if (result.status === "confirmed") notify("Paiement confirmé. Votre ticket Wi-Fi est disponible dans votre espace.");
      else if (result.status === "rejected") fail("Le paiement n’a pas été confirmé. Si vous avez payé, contactez le support.");
      else notify("Paiement en cours de vérification. Le ticket apparaîtra automatiquement après confirmation.");
      await loadMyRecords();
    }).catch((e) => {
      if (alive) fail((e as Error).message);
    });
    return () => { alive = false; };
  }, [session?.access_token]);

  const loadAdmin = async () => {
    setBusy(true);
    fail("");
    try {
      const [s, c, p, t, pl, benefits] = await Promise.all([
        api<Summary>("/api/admin/summary"),
        api<{ customers: Profile[] }>("/api/admin/customers"),
        api<{ payments: Payment[] }>("/api/admin/payments"),
        api<{ tickets: WifiTicket[] }>("/api/admin/tickets"),
        api<{ plans: Plan[] }>("/api/admin/plans"),
        api<{globalDiscount:number;discounts:{user_id:string;percent:number;enabled:boolean}[];notices:{id:string;scope:string;user_id:string|null;reason:string;active:boolean;created_at:string}[]}>("/api/admin/customer-benefits"),
      ]);
      setSummary(s); setCustomers(c.customers); setPayments(p.payments); setTickets(t.tickets); setAdminPlans(pl.plans);
      setGlobalDiscount(String(benefits.globalDiscount || 0)); setIndividualDiscounts(benefits.discounts); setServiceNotices(benefits.notices);
      setTicketPlanId((current) => current || pl.plans.find((plan) => plan.is_active)?.id || "");
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (mode === "admin" && profile?.role === "admin") loadAdmin();
  }, [mode, profile?.id, profile?.role]);

  useEffect(() => {
    if (mode !== "admin" || profile?.role !== "admin") return;
    api<{ configured: boolean; connected: boolean }>("/api/admin/router/status")
      .then((r) => setRouterStatus(r.connected ? "Connecté" : r.configured ? "Injoignable" : "À configurer"))
      .catch(() => setRouterStatus("À configurer"));
  }, [mode, profile?.id]);

  const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans]);
  const chosenPlan = plans.find((p) => p.id === selectedPlan);

  const pageTitle = sections.find((s) => s.id === section)?.label || "Vue d’ensemble";
  const openReport = (printNow: boolean) => {
    if (reportStartDate && reportEndDate && reportStartDate > reportEndDate) {
      fail("La date de début doit être antérieure ou égale à la date de fin."); return;
    }
    const inReportRange = (value?: string | null) => {
      if (!value) return false;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return false;
      const day = `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
      return (!reportStartDate || day >= reportStartDate) && (!reportEndDate || day <= reportEndDate);
    };
    const reportPayments = payments.filter(p => inReportRange(p.created_at));
    const reportTickets = tickets.filter(t => inReportRange(t.issued_at || t.created_at));
    const reportCustomers = customers.filter(c => inReportRange(c.created_at));
    const reportDays: string[] = [];
    if (reportStartDate && reportEndDate) {
      const cursor = new Date(reportStartDate + "T12:00:00");
      const lastDay = new Date(reportEndDate + "T12:00:00");
      while (cursor <= lastDay && reportDays.length < 366) {
        reportDays.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`);
        cursor.setDate(cursor.getDate()+1);
      }
    }

    const confirmedPayments = reportPayments.filter(p => p.status === "confirmed");
    const reportRevenue = confirmedPayments.reduce((totals, p) => {
      const currency = p.currency === "USD" ? "USD" : "HTG";
      totals[currency] += Number(p.amount) || 0;
      return totals;
    }, { HTG: 0, USD: 0 });
    const periodLabel = reportStartDate || reportEndDate
      ? `${reportStartDate ? new Date(reportStartDate+"T00:00:00").toLocaleDateString("fr-FR") : "Début non défini"} au ${reportEndDate ? new Date(reportEndDate+"T00:00:00").toLocaleDateString("fr-FR") : "Aujourd’hui"}`
      : "Toutes les dates";
    const generatedAt = new Date();
    const stamp = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(generatedAt);
    const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
    const dailyRows = reportDays.map(day => {
      const dayPayments = reportPayments.filter(p => {
        const value = new Date(p.created_at);
        return !Number.isNaN(value.getTime()) && value.getFullYear()===Number(day.slice(0,4)) && value.getMonth()+1===Number(day.slice(5,7)) && value.getDate()===Number(day.slice(8,10));
      });
      const dayTickets = reportTickets.filter(t => {
        const value = new Date(t.issued_at || t.created_at);
        return !Number.isNaN(value.getTime()) && value.getFullYear()===Number(day.slice(0,4)) && value.getMonth()+1===Number(day.slice(5,7)) && value.getDate()===Number(day.slice(8,10));
      });
      const dayCustomers = reportCustomers.filter(c => {
        const value = new Date(c.created_at || "");
        return !Number.isNaN(value.getTime()) && value.getFullYear()===Number(day.slice(0,4)) && value.getMonth()+1===Number(day.slice(5,7)) && value.getDate()===Number(day.slice(8,10));
      });
      const dayRevenue = dayPayments.filter(p=>p.status==="confirmed").reduce((totals,p)=>{totals[p.currency==="USD"?"USD":"HTG"]+=Number(p.amount)||0;return totals;},{HTG:0,USD:0});
      return `<tr><td>${escapeHtml(new Date(day+"T12:00:00").toLocaleDateString("fr-FR"))}</td><td>${dayPayments.length}</td><td>${dayTickets.length}</td><td>${dayCustomers.length}</td><td>${escapeHtml(money(dayRevenue.HTG,"HTG"))}</td><td>${escapeHtml(money(dayRevenue.USD,"USD"))}</td></tr>`;
    }).join("");
    const paymentRows = reportPayments.map((p) => `<tr><td>${escapeHtml(p.payment_reference || p.id)}</td><td>${escapeHtml(p.customer_name || "Client")}</td><td>${escapeHtml(p.customer_phone || "—")}</td><td>${escapeHtml(p.wifi_plans?.name || "—")}</td><td>${escapeHtml(paymentLabel(p.payment_method))}</td><td>${escapeHtml(statusLabel(p.status))}</td><td>${escapeHtml(date(p.created_at))}</td><td>${escapeHtml(money(Number(p.amount), p.currency))}</td></tr>`).join("");
    const ticketRows = reportTickets.map((t) => `<tr><td>${escapeHtml(t.router_username || "—")}</td><td>${escapeHtml(t.wifi_plans?.name || "—")}</td><td>${escapeHtml(statusLabel(t.status))}</td><td>${escapeHtml(date(t.issued_at || t.created_at))}</td><td>${escapeHtml(date(t.expires_at))}</td></tr>`).join("");
    const customerRows = reportCustomers.map((c) => `<tr><td>${escapeHtml(c.full_name || "Sans nom")}</td><td>${escapeHtml(c.phone || "—")}</td><td>${escapeHtml(c.email || "—")}</td><td>${escapeHtml(date(c.created_at))}</td></tr>`).join("");
    const logo = "data:image/webp;base64,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";
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) { fail("Autorisez les fenêtres pop-up pour générer le rapport."); return; }
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport Skynet Wi-Fi - ${generatedAt.toISOString().slice(0,10)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18334a;margin:0;padding:28px;background:#fff}header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1684d6;padding-bottom:18px;margin-bottom:22px}header img{width:112px;height:76px;object-fit:contain}h1{font-size:25px;margin:0 0 5px}header p,.meta{margin:3px 0;color:#63788b;font-size:12px}.meta strong{color:#28445c}.actions{display:flex;gap:10px;justify-content:flex-end;margin:0 0 20px}.actions button{border:0;border-radius:7px;padding:11px 16px;font-weight:700;cursor:pointer;background:#167bd0;color:#fff}.actions button.secondary{background:#eaf2f8;color:#24465f}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.stat{border:1px solid #dce7ef;border-radius:9px;padding:13px}.stat small{display:block;color:#71869a;font-size:10px;margin-bottom:7px}.stat b{font-size:18px}.section{margin:24px 0}.section h2{font-size:16px;margin:0 0 10px;color:#173d5a}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#edf4f9;color:#35536b;text-align:left}th,td{border:1px solid #dfe7ee;padding:8px 7px;vertical-align:top}footer{border-top:1px solid #dce5ec;padding-top:12px;margin-top:28px;color:#8091a0;font-size:10px;display:flex;justify-content:space-between}.empty{color:#8796a4;font-size:12px;padding:12px 0}
      @media(max-width:700px){body{padding:15px}.stats{grid-template-columns:repeat(2,1fr)}header img{width:82px;height:60px}h1{font-size:20px}}
      @media print{body{padding:0}.actions{display:none!important}@page{size:landscape;margin:12mm}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}th,.stat{print-color-adjust:exact;-webkit-print-color-adjust:exact}.section{break-inside:avoid}table{font-size:8px}}
    </style></head><body>
      <div class="actions"><button class="secondary" onclick="window.close()">Fermer</button><button onclick="window.print()">Imprimer</button></div>
      <header><img src="${logo}" alt="Logo Skynet Wi-Fi"><div><h1>Rapport de gestion</h1><p><strong>Skynet Wi-Fi</strong> · Gonaïves, Haïti</p><p>Période : ${escapeHtml(periodLabel)}</p><p>Rapport généré le ${escapeHtml(stamp)}</p><p>Document administratif · Données réelles du système</p></div></header>
      <div class="meta"><strong>Administrateur :</strong> ${escapeHtml(profile?.full_name || profile?.email || "Administrateur")} &nbsp; | &nbsp; <strong>Compte :</strong> ${escapeHtml(profile?.email || "—")} &nbsp; | &nbsp; <strong>Routeur :</strong> ${escapeHtml(routerStatus)}</div>
      <div class="stats"><div class="stat"><small>Clients inscrits sur la période</small><b>${reportCustomers.length}</b></div><div class="stat"><small>Tickets émis sur la période</small><b>${reportTickets.length}</b></div><div class="stat"><small>Paiements confirmés (HTG)</small><b>${escapeHtml(money(reportRevenue.HTG,"HTG"))}</b></div><div class="stat"><small>Paiements confirmés (USD)</small><b>${escapeHtml(money(reportRevenue.USD,"USD"))}</b></div></div>
      ${reportDays.length ? `<section class="section"><h2>Résumé quotidien (${reportDays.length} jours)</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Paiements</th><th>Tickets</th><th>Clients</th><th>Revenus HTG</th><th>Revenus USD</th></tr></thead><tbody>${dailyRows}</tbody></table></div></section>` : ""}
      <section class="section"><h2>Historique des paiements (${reportPayments.length})</h2><div class="table-wrap">${reportPayments.length ? `<table><thead><tr><th>Référence</th><th>Client</th><th>Téléphone</th><th>Forfait</th><th>Moyen</th><th>Statut</th><th>Date</th><th>Montant</th></tr></thead><tbody>${paymentRows}</tbody></table>` : '<p class="empty">Aucun paiement enregistré.</p>'}</div></section>
      <section class="section"><h2>Registre des tickets Wi-Fi (${reportTickets.length})</h2><div class="table-wrap">${reportTickets.length ? `<table><thead><tr><th>Code</th><th>Forfait</th><th>Statut</th><th>Créé le</th><th>Expire le</th></tr></thead><tbody>${ticketRows}</tbody></table>` : '<p class="empty">Aucun ticket enregistré.</p>'}</div></section>
      <section class="section"><h2>Registre des clients (${reportCustomers.length})</h2><div class="table-wrap">${reportCustomers.length ? `<table><thead><tr><th>Nom</th><th>Téléphone</th><th>E-mail</th><th>Inscription</th></tr></thead><tbody>${customerRows}</tbody></table>` : '<p class="empty">Aucun client enregistré.</p>'}</div></section>
      <footer><span>Skynet Wi-Fi · Gonaïves, Haïti</span><span>Généré le ${escapeHtml(stamp)} · Document confidentiel</span></footer>
    </body></html>`);
    popup.document.close();
    setReportPreviewReady(true);
    if (printNow) popup.onload = () => { popup.focus(); popup.print(); };
  };
  const canOpenAdminDashboard = profile?.role === "admin" && profile.email?.trim().toLowerCase() === "nesleyestime1@gmail.com";
  const openAdminDashboard = () => {
    if (!canOpenAdminDashboard) return;
    window.history.pushState({}, "", "/admin");
    setSection("overview");
    setMode("admin");
  };

  const goCustomerView = (view: "home" | "account" | "tickets" | "requests") => {
    if (view !== customerView) window.history.pushState({ ...(window.history.state || {}), skynetWifiView: view }, "", window.location.href);
    setCustomerView(view);
    setCustomerMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const returnCustomerPage = () => {
    if (window.history.state?.skynetWifiView && window.history.state.skynetWifiView !== "home") window.history.back();
    else goCustomerView("home");
  };

  const saveCustomerProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); fail("");
    try {
      const result = await api<{ profile: Profile }>("/api/me", { method: "PATCH", body: JSON.stringify({ fullName: profileNameDraft, phone: profilePhoneDraft }) });
      setProfile({ ...result.profile, email: profile?.email });
      notify("Vos informations ont été mises à jour.");
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };

  const changeCustomerPassword = async (event: React.FormEvent) => {
    event.preventDefault(); fail("");
    if (!profile?.email) { fail("Impossible de vérifier votre compte. Reconnectez-vous."); return; }
    if (newPassword.length < 8) { fail("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (newPassword !== confirmNewPassword) { fail("Les deux nouveaux mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPassword });
      if (verifyError) throw new Error("Votre mot de passe actuel est incorrect.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      notify("Votre mot de passe a été changé avec succès.");
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };

  const openAuth = (intent: "customer" | "admin") => {
    setAuthIntent(intent); setAuthMode("login"); setAuthOpen(true); setError(""); setNotice("");
  };
  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault(); setAuthBusy(true); fail("");
    try {
      if (authMode === "signup") {
        const { data, error: signError } = await supabase.auth.signUp({
          email: authEmail.trim(), password: authPassword,
          options: { data: { full_name: fullName.trim(), phone: phone.trim() }, emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (signError) throw signError;
        if (!data.session) {
          setAuthOpen(false);
          setSignupConfirmationEmail(authEmail.trim());
        } else {
          setAuthOpen(false);
          notify("Votre compte est créé.");
        }
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (signError) throw signError;
        setAuthOpen(false);
        if (authIntent === "admin") setMode("admin");
        notify("Connexion réussie.");
      }
    } catch (e) { fail((e as Error).message); }
    finally { setAuthBusy(false); }
  };

  const resendSignupConfirmation = async () => {
    if (!signupConfirmationEmail) return;
    setResendBusy(true);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email: signupConfirmationEmail, options: { emailRedirectTo: window.location.origin } });
      if (resendError) throw resendError;
      notify("Un nouvel e-mail de confirmation vient d’être demandé.");
    } catch (e) { fail((e as Error).message); }
    finally { setResendBusy(false); }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setMode("customer"); setSection("overview"); setCustomerView("home"); setCustomerMenuOpen(false); window.history.replaceState({ ...(window.history.state || {}), skynetWifiView: "home" }, "", "/"); notify("Vous êtes déconnecté."); };
  const startPurchase = () => {
    if (!chosenPlan || chosenPlan.price == null || Number(chosenPlan.price) <= 0) {
      fail("Ce forfait n’a pas encore de tarif. Contactez le gestionnaire ou choisissez un forfait tarifé.");
      return;
    }
    if (!session) { openAuth("customer"); return; }
    setPhone(profile?.phone || "");
    setPaymentMethod("moncash"); setPaymentOpen(true); setError("");
  };
  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosenPlan || !phone.trim()) { fail("Entrez un numéro de téléphone valide."); return; }
    setBusy(true); fail("");
    try {
      const result = await api<{ payment: Payment; paymentUrl?: string; provider?: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ planId: chosenPlan.id, paymentMethod, customerPhone: phone.trim(),  }),
      });
      if (result.paymentUrl && result.provider === "tranzak") {
        window.location.assign(result.paymentUrl);
        return;
      }
      setPaymentOpen(false);
      notify(`Demande enregistrée. Référence de demande : ${result.payment.id}`);
      await loadMyRecords();
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };

  const confirmPayment = async (paymentId: string) => {
    if (!window.confirm("Confirmer que vous avez réellement reçu ce paiement ? Un ticket sera créé.")) return;
    setBusy(true); fail("");
    try {
      const result = await api<{ ticket: { code: string } }>(`/api/admin/payments/${paymentId}/confirm`, { method: "POST", body: "{}" });
      setIssuedCode(result.ticket.code);
      notify("Paiement confirmé et ticket créé.");
      await loadAdmin();
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };
  const rejectPayment = async (paymentId: string) => {
    if (!window.confirm("Refuser cette demande de paiement ?")) return;
    setBusy(true); fail("");
    try {
      await api(`/api/admin/payments/${paymentId}/reject`, { method: "POST", body: "{}" });
      notify("Demande de paiement refusée."); await loadAdmin();
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };
  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticketPlanId) { fail("Sélectionnez un forfait actif."); return; }
    setBusy(true); fail("");
    try {
      const result = await api<{ ticket: { code: string } }>("/api/admin/tickets", {
        method: "POST", body: JSON.stringify({ planId: ticketPlanId, userId: ticketCustomerId || undefined }),
      });
      setIssuedCode(result.ticket.code);
      notify("Ticket créé. Conservez le code : il ne sera pas réaffiché après fermeture.");
      await loadAdmin();
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };
  const changeTicketStatus = async (ticket: WifiTicket, status: "created" | "blocked" | "revoked") => {
    const prompt = status === "revoked" ? "Révoquer définitivement ce ticket ?" : status === "blocked" ? "Bloquer ce ticket ?" : "Réactiver ce ticket dans le registre ?";
    if (!window.confirm(prompt)) return;
    setBusy(true); fail("");
    try {
      await api(`/api/admin/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify(`Statut du ticket modifié : ${statusLabel(status)}.`); await loadAdmin();
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };
  const savePlan = async (plan: Plan, priceText: string) => {
    const parsed = priceText.trim() === "" ? null : Number(priceText);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) { fail("Le prix doit être un montant supérieur à zéro."); return; }
    setBusy(true); fail("");
    try {
      const result = await api<{ plan: Plan }>(`/api/admin/plans/${plan.id}`, {
        method: "PATCH", body: JSON.stringify({ price: parsed, currency: plan.currency }),
      });
      setAdminPlans((items) => items.map((p) => p.id === plan.id ? result.plan : p));
      await loadPlans(); notify(`Tarif de ${plan.name} enregistré.`);
    } catch (e) { fail((e as Error).message); }
    finally { setBusy(false); }
  };

  if (mode === "admin" && profile?.role !== "admin") {
    return <div className="app-shell"><header className="topbar"><Brand /><button className="mode-switch" onClick={() => setMode("customer")}><Globe2 size={16} /> Portail client</button></header><main className="auth-required"><div className="panel auth-required-card"><div className="setting-icon"><LockKeyhole /></div><h2>Accès administrateur requis</h2><p>Connectez-vous avec un compte autorisé comme administrateur pour ouvrir la gestion Skynet Wi-Fi.</p><button className="button button-primary" onClick={() => openAuth("admin")}>Connexion administrateur</button></div></main>{authOpen && <AuthModal {...{authMode,setAuthMode,authEmail,setAuthEmail,authPassword,setAuthPassword,fullName,setFullName,phone,setPhone,authBusy,error,onSubmit:handleAuth,onClose:()=>setAuthOpen(false)}} />}{notice && <Toast message={notice} onClose={()=>setNotice("")}/>}</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          {mode === "customer" && <nav className="customer-desktop-nav" aria-label="Navigation principale">
            <button className={customerView === "home" ? "active" : ""} onClick={() => goCustomerView("home")}>Accueil</button>
            <button onClick={() => { if (customerView !== "home") goCustomerView("home"); document.getElementById("forfaits")?.scrollIntoView({ behavior: "smooth" }); }}>Forfaits</button>
            <button className={customerView === "account" ? "active" : ""} onClick={() => session ? goCustomerView("account") : openAuth("customer")}>Mon compte</button>
            {session && <button className={customerView === "tickets" ? "active" : ""} onClick={() => goCustomerView("tickets")}>Mes tickets</button>}
            {session && <button className={customerView === "requests" ? "active" : ""} onClick={() => goCustomerView("requests")}>Mes demandes</button>}
          </nav>}
          {mode === "customer" && canOpenAdminDashboard && <button className="mode-switch" onClick={openAdminDashboard}><LayoutDashboard size={16} /> Dashboard</button>}
          {mode === "customer" && <button className="customer-profile-button" aria-label="Mon compte" title="Mon compte" onClick={() => session ? goCustomerView("account") : openAuth("customer")}><UserRound size={19}/></button>}
          {mode === "customer" && session && <button className="customer-menu-button" aria-label="Ouvrir le menu" aria-expanded={customerMenuOpen} onClick={() => setCustomerMenuOpen(v => !v)}><Menu size={22}/></button>}
          {mode === "admin" && <button className="mode-switch" onClick={() => { window.history.pushState({}, "", "/"); setMode("customer"); }}><Globe2 size={16} /> Portail client</button>}
          {mode === "admin" && session && <button className="mode-switch" onClick={handleSignOut}><LogOut size={15}/> Déconnexion</button>}
        </div>
      </header>
      {mode === "customer" && customerMenuOpen && session && <div className="customer-menu-backdrop" onClick={() => setCustomerMenuOpen(false)}><nav className="customer-menu-panel" aria-label="Menu client" onClick={e => e.stopPropagation()}><button onClick={() => goCustomerView("account")}><UserRound size={18}/> Mon compte</button><button onClick={() => goCustomerView("tickets")}><ClipboardList size={18}/> Mes tickets</button><button onClick={() => goCustomerView("requests")}><FileText size={18}/> Mes demandes</button></nav></div>}

      {mode === "customer" ? (
        <main className="customer-page">
          <section className={`hero ${customerView !== "home" ? "hidden-customer-view" : ""}`}>
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> INTERNET HAUT DÉBIT À GONAÏVES</div>
              <h1>Le Wi-Fi qui vous<br/><em>connecte au monde.</em></h1>
              <p>Une connexion simple, rapide et accessible. Choisissez votre forfait et profitez d’Internet avec Skynet Wi-Fi.</p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={()=>document.getElementById("forfaits")?.scrollIntoView({behavior:"smooth"})}>Voir les forfaits <ArrowRight size={17}/></button>
                {!session && <button className="button button-ghost" onClick={()=>openAuth("customer")}>Créer un compte / Connexion</button>}
              </div>
              <div className="hero-trust"><span><ShieldCheck size={16}/> Paiements vérifiés</span><span><Zap size={16}/> Ticket après confirmation</span></div>
            </div>
            <div className="hero-art" aria-label="Illustration du réseau Wi-Fi"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="signal-core"><Wifi size={66} strokeWidth={1.45}/></div><div className="float-card float-speed"><Gauge size={17}/><div><b>Forfaits flexibles</b><small>Selon votre besoin</small></div></div><div className="float-card float-status"><span className="live-dot" style={{background:"#d58b47"}}/><div><b>Routeur à installer</b><small>Activation après installation</small></div></div><div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✧</div></div>
          </section>

          {false && session && <section className="my-records" id="profil-client">
            <div className="section-heading"><div><div className="eyebrow">ESPACE CLIENT</div><h2>Mon profil et mes informations</h2><p>Consultez vos coordonnées et les communications de Skynet Wi-Fi.</p></div></div>
            {customerNotices.map(n=><div className="panel table-panel" key={n.id}><b>Information importante</b><p>{n.reason}</p><small>{date(n.created_at)}</small></div>)}
            {customerDiscount.percent>0 && <div className="panel table-panel"><b>Votre rabais : {customerDiscount.percent}%</b><p>Cette réduction sera automatiquement appliquée lors de votre paiement.</p></div>}
            <form className="panel create-ticket-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const result=await api<{profile:Profile}>("/api/me",{method:"PATCH",body:JSON.stringify({fullName:profileNameDraft,phone:profilePhoneDraft})});setProfile({...result.profile,email:profile?.email});notify("Votre profil a été mis à jour.");}catch(err){fail((err as Error).message);}finally{setBusy(false);}}}>
              <div><label>Nom complet</label><input value={profileNameDraft} onChange={e=>setProfileNameDraft(e.target.value)} required minLength={2}/></div>
              <div><label>Adresse e-mail</label><input value={profile?.email||""} readOnly/></div>
              <div><label>Téléphone</label><input value={profilePhoneDraft} onChange={e=>setProfilePhoneDraft(e.target.value)} required minLength={7}/></div>
              <button className="button button-primary" disabled={busy}>Enregistrer mon profil</button>
            </form>
          </section>}
          {session && customerView === "account" && <section className="customer-account-section">
            <div className="customer-view-heading"><button className="customer-back-button" onClick={returnCustomerPage}><ArrowLeft size={16}/> Retour</button><div className="eyebrow">ESPACE CLIENT</div><h2>Mon compte</h2><p>Gérez vos coordonnées et la sécurité de votre compte.</p></div>
            {customerNotices.map(n=><div className="panel customer-info-panel" key={n.id}><b>Information importante</b><p>{n.reason}</p><small>{date(n.created_at)}</small></div>)}
            {customerDiscount.percent>0 && <div className="panel customer-info-panel"><b>Votre rabais : {customerDiscount.percent}%</b><p>Cette réduction sera automatiquement appliquée lors de votre paiement.</p></div>}
            <form className="panel customer-settings-form" onSubmit={saveCustomerProfile}><h3>Mes informations</h3><div><label>Nom complet</label><input value={profileNameDraft} onChange={e=>setProfileNameDraft(e.target.value)} required minLength={2}/></div><div><label>Adresse e-mail</label><input value={profile?.email||""} readOnly/></div><div><label>Numéro de téléphone</label><input type="tel" inputMode="tel" value={profilePhoneDraft} onChange={e=>setProfilePhoneDraft(e.target.value)} required minLength={7}/></div><button className="button button-primary" disabled={busy}>Enregistrer mes informations</button></form>
            <form className="panel customer-settings-form" onSubmit={changeCustomerPassword}><h3><KeyRound size={18}/> Changer mon mot de passe</h3><div><label>Mot de passe actuel</label><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></div><div><label>Nouveau mot de passe</label><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/><small>8 caractères minimum.</small></div><div><label>Confirmer le nouveau mot de passe</label><input type="password" autoComplete="new-password" minLength={8} value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} required/></div><button className="button button-primary" disabled={busy}>Mettre à jour le mot de passe</button></form>
            <div className="customer-account-actions"><button className="button button-outline" onClick={handleSignOut}><LogOut size={16}/> Déconnexion</button></div>
          </section>}
          {session && customerView === "tickets" && <section className="customer-records-page"><div className="customer-view-heading"><button className="customer-back-button" onClick={returnCustomerPage}><ArrowLeft size={16}/> Retour</button><div className="eyebrow">ESPACE CLIENT</div><h2>Mes tickets</h2><p>Retrouvez les tickets Wi-Fi créés après confirmation de vos paiements.</p><button className="button button-outline" onClick={loadMyRecords}><RefreshCw size={14}/> Actualiser</button></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Mes tickets Wi-Fi</h3><p>Vos codes de connexion.</p></div></div>{myTickets.length===0?<div className="empty-table"><Ticket/><span>Aucun ticket délivré pour le moment.</span></div>:<div className="my-record-list">{myTickets.map(t=><div className="my-record-row ticket-record" key={t.id}><div><b>{t.router_username||"Code en préparation"}</b><small>{t.wifi_plans?.name||"Forfait Wi-Fi"} · {date(t.issued_at)}</small></div><Status value={t.status}/></div>)}</div>}<p className="field-help">Les tickets seront utilisables dès que le routeur MikroTik sera installé et connecté.</p></div></section>}
          {session && customerView === "requests" && <section className="customer-records-page"><div className="customer-view-heading"><button className="customer-back-button" onClick={returnCustomerPage}><ArrowLeft size={16}/> Retour</button><div className="eyebrow">ESPACE CLIENT</div><h2>Mes demandes</h2><p>Suivez l’état de vos demandes de paiement.</p><button className="button button-outline" onClick={loadMyRecords}><RefreshCw size={14}/> Actualiser</button></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Historique des demandes</h3><p>Les demandes de paiement associées à votre compte.</p></div></div>{myPayments.length===0?<div className="empty-table"><CreditCard/><span>Aucune demande enregistrée.</span></div>:<div className="my-record-list">{myPayments.map(p=><div className="my-record-row" key={p.id}><div><b>{p.wifi_plans?.name||"Forfait Wi-Fi"}</b><small>{date(p.created_at)} · {paymentLabel(p.payment_method)}</small></div><strong>{money(Number(p.amount),p.currency)}</strong><Status value={p.status}/></div>)}</div>}</div></section>}
          <section className={`plans-section ${customerView !== "home" ? "hidden-customer-view" : ""}`} id="forfaits">
            <div className="section-heading"><div><div className="eyebrow">NOS OFFRES</div><h2>Choisissez votre connexion</h2><p>Les prix affichés proviennent directement du catalogue Skynet Wi-Fi.</p></div><span className="no-price-note">{catalogLoading?"Chargement des forfaits":catalogError?"Catalogue indisponible":"Forfaits synchronisés"}</span></div>
            {catalogError ? <div className="panel error-panel">{catalogError} <button className="button button-outline" onClick={loadPlans}>Réessayer</button></div> : catalogLoading ? <div className="panel empty-table">Chargement des forfaits…</div> : activePlans.length === 0 ? <div className="panel empty-table">Aucun forfait actif pour le moment.</div> : <div className="plan-grid">
              {activePlans.map((plan)=><button key={plan.id} className={`plan-card ${selectedPlan===plan.id?"selected":""}`} onClick={()=>setSelectedPlan(plan.id)}>
                {plan.code==="SKY-7D"&&<span className="popular-tag">POPULAIRE</span>}
                <span className="plan-icon"><Clock3 size={21}/></span><strong>{plan.name}</strong><span className="plan-duration">{formatDuration(plan.duration_seconds)}</span><p className={`plan-price ${plan.price==null?"pending":""}`}>{plan.price==null?"Tarif en attente de validation":money(Number(plan.price)*(1-(session?customerDiscount.percent:0)/100),plan.currency)}</p>{session&&customerDiscount.percent>0&&<small className="field-help">Rabais de {customerDiscount.percent}% inclus</small>}<span className="plan-select">{selectedPlan===plan.id?<><Check size={14}/> Sélectionné</>:"Choisir ce forfait"}</span>
              </button>)}
            </div>}
            <div className="purchase-strip"><div className="purchase-icon"><Ticket size={22}/></div><div><b>Prêt à faire votre demande ?</b><span>Un ticket est délivré après vérification du paiement.</span></div><button className="button button-primary" disabled={!chosenPlan||chosenPlan.price==null||Number(chosenPlan.price)<=0} onClick={startPurchase}>Continuer <ArrowRight size={16}/></button></div>
            {false && session&&<section className="my-records">
              <div className="section-heading"><div><div className="eyebrow">ESPACE CLIENT</div><h2>Mes demandes et mes tickets</h2><p>Suivez les paiements et retrouvez vos tickets Skynet Wi-Fi.</p></div><button className="button button-outline" onClick={loadMyRecords}><RefreshCw size={14}/> Actualiser</button></div>
              <div className="my-record-grid">
                <div className="panel table-panel"><div className="panel-heading"><div><h3>Mes paiements</h3><p>Demandes de paiement récentes.</p></div></div>
                  {myPayments.length===0?<div className="empty-table"><CreditCard/><span>Aucune demande de paiement.</span></div>:<div className="my-record-list">{myPayments.map(p=><div className="my-record-row" key={p.id}><div><b>{p.wifi_plans?.name||"Forfait Wi-Fi"}</b><small>{date(p.created_at)} · {paymentLabel(p.payment_method)}</small></div><strong>{money(Number(p.amount),p.currency)}</strong><Status value={p.status}/></div>)}</div>}
                </div>
                <div className="panel table-panel"><div className="panel-heading"><div><h3>Mes tickets</h3><p>Les codes émis après confirmation.</p></div></div>
                  {myTickets.length===0?<div className="empty-table"><Ticket/><span>Aucun ticket délivré pour le moment.</span></div>:<div className="my-record-list">{myTickets.map(t=><div className="my-record-row ticket-record" key={t.id}><div><b>{t.router_username||"Code en préparation"}</b><small>{t.wifi_plans?.name||"Forfait Wi-Fi"} · {date(t.issued_at)}</small></div><Status value={t.status}/></div>)}</div>}
                  <p className="field-help">Les tickets seront utilisables dès que le routeur MikroTik sera installé et connecté.</p>
                </div>
              </div>
            </section>}
          </section>
          <section className={`how-section ${customerView !== "home" ? "hidden-customer-view" : ""}`}><div className="section-heading centered"><div className="eyebrow">C’EST SIMPLE</div><h2>Connectez-vous en 3 étapes</h2></div><div className="steps-grid"><div className="step"><span>01</span><div className="step-icon"><Signal/></div><b>Choisissez un forfait</b><p>Sélectionnez une durée et créez votre demande de paiement.</p></div><div className="step"><span>02</span><div className="step-icon"><CreditCard/></div><b>Faites le paiement</b><p>Effectuez le paiement selon le moyen choisi et conservez la référence.</p></div><div className="step"><span>03</span><div className="step-icon"><Ticket/></div><b>Recevez votre ticket</b><p>Après vérification par Skynet, votre code de connexion sera créé.</p></div></div></section>
          <footer className={`footer ${customerView !== "home" ? "hidden-customer-view" : ""}`}><Brand/><span>© {new Date().getFullYear()} Skynet Wi-Fi. Tous droits réservés.</span><span>Support : contactez l’administrateur du réseau.</span></footer>
        </main>
      ) : (
        <div className="admin-layout">
          <aside className={`sidebar ${menuOpen?"sidebar-open":""}`}>
            <div className="sidebar-brand"><Brand/><button className="icon-button mobile-only" onClick={()=>setMenuOpen(false)}><X/></button></div>
            <div className="side-label">MENU PRINCIPAL</div>
            <nav>{sections.map((item)=>{const Icon=item.icon;return <button key={item.id} className={`nav-item ${section===item.id?"active":""}`} onClick={()=>{setSection(item.id);setMenuOpen(false);}}><Icon size={18}/><span>{item.label}</span>{item.id==="payments"&&summary?.pendingPayments ? <i className="nav-count">{summary.pendingPayments}</i>:null}</button>;})}</nav>
            <div className="sidebar-bottom"><div className="router-status"><span className="live-dot" style={{background:routerStatus==="Connecté"?"#20bd83":"#e5a24b"}}/><div><b>MikroTik</b><small>{routerStatus}</small></div><span className="status-tag">{routerStatus==="Connecté"?"EN LIGNE":"ATTENTE"}</span></div><div className="admin-profile"><div className="avatar">{(profile?.full_name||profile?.email||"A").slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name||"Administrateur"}</b><small>{profile?.email}</small></div></div></div>
          </aside>
          <main className="admin-main">
            <div className="admin-header"><button className="icon-button mobile-only" onClick={()=>setMenuOpen(true)}><Menu/></button><div><div className="breadcrumb">Skynet Wi-Fi <span>/</span> {pageTitle}</div><h1>{pageTitle}</h1></div><div className="admin-header-actions"><span className="date-label"><CalendarClock size={16}/>{new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</span><button className="icon-button" title="Actualiser" onClick={loadAdmin}><RefreshCw size={17}/></button><button className="admin-avatar">{(profile?.full_name||"A").slice(0,1).toUpperCase()}</button></div></div>
            {busy&&<div className="loading-line">Mise à jour des données…</div>}
            {section==="overview"&&<div className="dashboard-content">
              <div className="welcome-row"><div><h2>Bonjour, {profile?.full_name||"Administrateur"} 👋</h2><p>Statistiques réelles enregistrées dans Skynet Wi-Fi.</p></div></div>
              <div className="stats-grid">
                <Stat icon={<Users/>} label="Clients inscrits" value={summary?.customers??"—"} note="Comptes clients" tone="blue"/>
                <Stat icon={<Ticket/>} label="Tickets créés" value={summary?.totalTickets??"—"} note={`${summary?.activeTickets??0} actifs dans le registre`} tone="purple"/>
                <Stat icon={<CreditCard/>} label="Paiements en attente" value={summary?.pendingPayments??"—"} note="À vérifier manuellement" tone="orange"/>
                <Stat icon={<Wallet/>} label="Forfaits actifs" value={summary?.activePlans??"—"} note="Catalogue de vente" tone="green"/>
              </div>
              <div className="stats-grid revenue-grid"><Stat icon={<Wallet/>} label="Revenus confirmés (HTG)" value={money(summary?.revenue?.HTG??0,"HTG")} note="Somme des paiements confirmés" tone="green"/><Stat icon={<CreditCard/>} label="Revenus confirmés (USD)" value={money(summary?.revenue?.USD??0,"USD")} note="Somme des paiements confirmés" tone="blue"/></div>
              <div className="dashboard-grid"><div className="panel activity-panel"><div className="panel-heading"><div><h3>État du réseau</h3><p>État actuel de l’intégration MikroTik</p></div><span className="offline-label"><span/>{routerStatus}</span></div><div className="empty-chart"><div className="chart-icon"><Radio size={28}/></div><b>{routerStatus==="Connecté"?"Routeur joignable":"Routeur non connecté"}</b><p>{routerStatus==="Connecté"?"Le routeur répond à la vérification de statut.":"Les sessions et appareils connectés seront suivis lorsque le routeur sera installé et relié au serveur de façon sécurisée."}</p></div></div><div className="panel quick-panel"><div className="panel-heading"><div><h3>Actions rapides</h3><p>Opérations de gestion</p></div></div><button onClick={()=>setSection("tickets")}><span className="quick-icon violet"><Plus/></span><span><b>Créer un ticket</b><small>Émettre un code manuel</small></span><ArrowRight size={16}/></button><button onClick={()=>setSection("payments")}><span className="quick-icon green"><CreditCard/></span><span><b>Vérifier les paiements</b><small>Confirmer ou refuser</small></span><ArrowRight size={16}/></button><button onClick={()=>setSection("plans")}><span className="quick-icon blue"><Wallet/></span><span><b>Gérer les tarifs</b><small>Modifier les forfaits</small></span><ArrowRight size={16}/></button></div></div>
            </div>}
            {section==="customers"&&<div className="dashboard-content"><div className="toolbar"><div className="search-box"><Search size={17}/><input placeholder="Rechercher un client…" value={search} onChange={(e)=>setSearch(e.target.value)}/></div><span className="count-chip">{customers.length} clients affichés</span></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Liste des clients</h3><p>Comptes inscrits dans Supabase.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Téléphone</th><th>Inscription</th></tr></thead><tbody>{customers.filter(c=>`${c.full_name||""} ${c.email||""} ${c.phone||""}`.toLowerCase().includes(search.toLowerCase())).map(c=><tr key={c.id}><td><b>{c.full_name||"Sans nom"}</b><small>{c.email||c.id}</small></td><td>{c.phone||"—"}</td><td>{date(c.created_at)}</td></tr>)}</tbody></table>{customers.length===0&&<div className="empty-table"><Users/><span>Aucun client inscrit pour le moment.</span></div>}</div></div></div>}
            {section==="tickets"&&<div className="dashboard-content"><div className="section-intro"><div><h2>Gestion des tickets</h2><p>Créez, consultez, bloquez ou révoquez les tickets.</p></div></div><form className="panel create-ticket-form" onSubmit={createTicket}><div><label>Forfait</label><select value={ticketPlanId} onChange={e=>setTicketPlanId(e.target.value)} required><option value="">Choisir un forfait actif</option>{adminPlans.filter(p=>p.is_active).map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.price,p.currency)}</option>)}</select></div><div><label>Associer à un client (facultatif)</label><select value={ticketCustomerId} onChange={e=>setTicketCustomerId(e.target.value)}><option value="">Ticket sans compte client</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name||c.email||c.id}</option>)}</select></div><button className="button button-primary" disabled={busy||!ticketPlanId}><Plus size={16}/> Créer le ticket</button></form><div className="panel table-panel"><div className="panel-heading"><div><h3>Tickets enregistrés</h3><p>Le code est le nom d’utilisateur prévu pour le routeur.</p></div><span className="count-chip">{tickets.length} tickets</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Forfait</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead><tbody>{tickets.map(t=><tr key={t.id}><td><b>{t.router_username||"—"}</b><small>{t.payment_id?"Paiement lié":"Création manuelle"}</small></td><td>{t.wifi_plans?.name||"Forfait"}</td><td><Status value={t.status}/></td><td>{date(t.created_at)}</td><td><div className="table-actions">{t.status!=="revoked"&&<button title="Bloquer" onClick={()=>changeTicketStatus(t,t.status==="blocked"?"created":"blocked")}><Ban size={15}/></button>}<button title="Révoquer" disabled={t.status==="revoked"} onClick={()=>changeTicketStatus(t,"revoked")}><X size={15}/></button></div></td></tr>)}</tbody></table>{tickets.length===0&&<div className="empty-table"><Ticket/><span>Aucun ticket enregistré.</span></div>}</div></div></div>}
            {section==="payments"&&<div className="dashboard-content"><div className="section-intro"><div><h2>Suivi des paiements</h2><p>Vérifiez la réception effective avant toute confirmation.</p></div><span className="pending-chip">{payments.filter(p=>p.status==="pending").length} en attente</span></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Transactions</h3><p>Demandes réelles enregistrées par les clients.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Référence / Client</th><th>Forfait</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td><b>{p.customer_name||"Client"}</b><small>{p.customer_phone||"Téléphone non renseigné"}</small><small>{p.customer_email||"E-mail non renseigné"}</small><small className="payment-reference-code">Réf. client : {p.customer_reference||"—"}</small><small className="payment-reference-code">Réf. paiement : {p.payment_reference||p.id}</small>{p.provider_reference&&<small className="payment-reference-code">Réf. Tranzak : {p.provider_reference}</small>}</td><td>{p.wifi_plans?.name||"—"}</td><td>{money(Number(p.amount),p.currency)}</td><td>{paymentLabel(p.payment_method)}</td><td><Status value={p.status}/></td><td>{date(p.created_at)}</td><td>{p.status==="pending"&&p.provider_payload?.provider==="tranzak"?<small>Confirmation automatique Tranzak</small>:p.status==="pending"?<div className="table-actions"><button className="confirm-action" title="Confirmer et créer le ticket" disabled={busy} onClick={()=>confirmPayment(p.id)}><Check size={15}/></button><button title="Refuser" disabled={busy} onClick={()=>rejectPayment(p.id)}><X size={15}/></button></div>:"—"}</td></tr>)}</tbody></table>{payments.length===0&&<div className="empty-table"><CreditCard/><span>Aucune demande de paiement enregistrée.</span></div>}</div></div></div>}
            {section==="plans"&&<div className="dashboard-content"><div className="section-intro"><div><h2>Forfaits Wi-Fi</h2><p>Modifiez les prix et activez ou désactivez les offres.</p></div></div><div className="admin-plans live-admin-plans">{adminPlans.map(plan=><PlanEditor key={plan.id} plan={plan} busy={busy} onSave={savePlan} onRefresh={loadAdmin}/>)}</div></div>}
            {section==="benefits"&&<div className="dashboard-content">
              <div className="section-intro"><div><h2>Rabais et informations clients</h2><p>Gérez les réductions et informez les clients des interruptions de service.</p></div></div>
              <form className="panel create-ticket-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api("/api/admin/customer-benefits/global-discount",{method:"PUT",body:JSON.stringify({percent:Number(globalDiscount)})});notify("Rabais global enregistré.");await loadAdmin();}catch(err){fail((err as Error).message);}finally{setBusy(false);}}}>
                <div><label>Rabais global (%) — tous les clients</label><input type="number" min="0" max="99.99" step="0.5" value={globalDiscount} onChange={e=>setGlobalDiscount(e.target.value)}/><small>Mettre 0 pour désactiver le rabais global.</small></div>
                <button className="button button-primary" disabled={busy}>Enregistrer le rabais global</button>
              </form>
              <form className="panel create-ticket-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api("/api/admin/customer-benefits/individual-discount",{method:"PUT",body:JSON.stringify({userId:benefitCustomerId,percent:Number(individualDiscountPercent)})});notify("Rabais individuel enregistré.");await loadAdmin();}catch(err){fail((err as Error).message);}finally{setBusy(false);}}}>
                <div><label>Client concerné</label><select value={benefitCustomerId} onChange={e=>setBenefitCustomerId(e.target.value)} required><option value="">Choisir un client</option>{customers.map(x=><option key={x.id} value={x.id}>{x.full_name||x.email||x.id} — {x.email||"sans e-mail"}</option>)}</select></div>
                <div><label>Rabais individuel (%) — 0 pour retirer</label><input type="number" min="0" max="99.99" step="0.5" value={individualDiscountPercent} onChange={e=>setIndividualDiscountPercent(e.target.value)} required/></div>
                <button className="button button-primary" disabled={busy||!benefitCustomerId}>Appliquer le rabais</button>
              </form>
              <div className="panel table-panel"><div className="panel-heading"><div><h3>Rabais individuels actifs</h3><p>Le rabais individuel remplace le global pour ce client.</p></div></div>
                {individualDiscounts.filter(x=>x.enabled).length===0?<div className="empty-table">Aucun rabais individuel actif.</div>:individualDiscounts.filter(x=>x.enabled).map(x=><div className="my-record-row" key={x.user_id}><b>{customers.find(v=>v.id===x.user_id)?.full_name||customers.find(v=>v.id===x.user_id)?.email||x.user_id}</b><strong>{x.percent}%</strong></div>)}
              </div>
              <form className="panel create-ticket-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api("/api/admin/service-notices",{method:"POST",body:JSON.stringify({scope:noticeScope,userId:noticeScope==="individual"?noticeCustomerId:undefined,reason:noticeReason})});setNoticeReason("");notify("Information publiée.");await loadAdmin();}catch(err){fail((err as Error).message);}finally{setBusy(false);}}}>
                <div><label>Destinataires</label><select value={noticeScope} onChange={e=>setNoticeScope(e.target.value as "global"|"individual")}><option value="global">Tous les clients</option><option value="individual">Un client précis</option></select></div>
                {noticeScope==="individual"&&<div><label>Client</label><select value={noticeCustomerId} onChange={e=>setNoticeCustomerId(e.target.value)} required><option value="">Choisir un client</option>{customers.map(x=><option key={x.id} value={x.id}>{x.full_name||x.email||x.id}</option>)}</select></div>}
                <div><label>Motif / information de service</label><textarea value={noticeReason} onChange={e=>setNoticeReason(e.target.value)} minLength={3} maxLength={1000} required placeholder="Ex. Interruption temporaire du service en raison de…"/></div>
                <button className="button button-primary" disabled={busy||(noticeScope==="individual"&&!noticeCustomerId)}>Publier l'information</button>
              </form>
              <div className="panel table-panel"><div className="panel-heading"><div><h3>Historique des avis</h3><p>Vous pouvez désactiver ou réactiver un avis.</p></div></div>
                {serviceNotices.length===0?<div className="empty-table">Aucun avis publié.</div>:serviceNotices.map(n=><div className="my-record-row" key={n.id}><div><b>{n.scope==="global"?"Tous les clients":("Client : "+(customers.find(v=>v.id===n.user_id)?.full_name||customers.find(v=>v.id===n.user_id)?.email||"individuel"))}</b><p>{n.reason}</p><small>{date(n.created_at)}</small></div><button className="button button-outline" onClick={async()=>{try{await api("/api/admin/service-notices/"+n.id,{method:"PATCH",body:JSON.stringify({active:!n.active})});notify("Statut de l'avis mis à jour.");await loadAdmin();}catch(err){fail((err as Error).message);}}}>{n.active?"Désactiver":"Réactiver"}</button></div>)}
              </div>
            </div>}
            {section==="reports"&&<div className="dashboard-content">
              <div className="section-intro"><div><h2>Centre de rapports</h2><p>Choisissez une date de début et une date de fin pour limiter les paiements, tickets, clients et revenus du rapport.</p></div></div>
              <div className="panel report-center">
                <div className="report-preview-brand"><div className="report-logo"><Brand/></div><div><h3>Rapport général Skynet Wi-Fi</h3><p>Gonaïves, Haïti · Données actualisées depuis le système</p><small>Génération : {new Date().toLocaleDateString("fr-FR")} à {new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</small></div></div>
                <div className="report-date-filters">
                  <div><label htmlFor="report-start-date">Date début</label><input id="report-start-date" type="date" value={reportStartDate} onChange={e=>{setReportStartDate(e.target.value);setReportPreviewReady(false);}}/></div>
                  <div><label htmlFor="report-end-date">Date fin</label><input id="report-end-date" type="date" value={reportEndDate} onChange={e=>{setReportEndDate(e.target.value);setReportPreviewReady(false);}}/></div>
                  <button className="button button-outline" type="button" onClick={()=>{setReportStartDate("");setReportEndDate("");setReportPreviewReady(false);}}>Toutes les dates</button>
                </div>
                <p className="report-period-preview">Période sélectionnée : <strong>{reportStartDate?new Date(reportStartDate+"T00:00:00").toLocaleDateString("fr-FR"):"Depuis le début"}</strong> — <strong>{reportEndDate?new Date(reportEndDate+"T00:00:00").toLocaleDateString("fr-FR"):"Jusqu’à aujourd’hui"}</strong></p>
                <div className="report-preview-stats">
                  <div><small>Clients</small><b>{customers.length}</b></div><div><small>Paiements</small><b>{payments.length}</b></div><div><small>Tickets</small><b>{tickets.length}</b></div><div><small>Revenus HTG</small><b>{money(summary?.revenue?.HTG??0,"HTG")}</b></div><div><small>Revenus USD</small><b>{money(summary?.revenue?.USD??0,"USD")}</b></div>
                </div>
                <div className="report-actions"><button className="button button-primary" onClick={()=>openReport(false)}><FileText size={16}/> Générer l’aperçu</button><button className="button button-outline" disabled={!reportPreviewReady} onClick={()=>openReport(true)}><Download size={16}/> Télécharger PDF</button><button className="button button-outline" disabled={!reportPreviewReady} onClick={()=>openReport(true)}><Printer size={16}/> Imprimer</button></div>
                <p className="report-help">Le document imprimable comprend l’identité Skynet Wi-Fi, la date et l’heure de génération, les statistiques financières ainsi que les registres détaillés des paiements, tickets et clients. Pour obtenir le PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.</p>
              </div>
            </div>}
            {section==="settings"&&<div className="dashboard-content"><div className="section-intro"><div><h2>Paramètres du système</h2><p>État des services réellement configurés.</p></div></div><div className="settings-grid"><div className="panel setting-card"><div className="setting-icon"><Radio/></div><h3>Routeur MikroTik</h3><p>Le routeur n’a pas encore été acheté ni connecté.</p><span className="offline-label"><span/> {routerStatus}</span></div><div className="panel setting-card"><div className="setting-icon"><Globe2/></div><h3>API Skynet Wi-Fi</h3><p>Service backend hébergé sur Render.</p><span className={apiHealth==="online"?"online-label":"offline-label"}>{apiHealth==="online"?"Disponible":apiHealth==="offline"?"Indisponible":"Vérification"}</span></div><div className="panel setting-card"><div className="setting-icon"><ShieldCheck/></div><h3>Compte administrateur</h3><p>{profile?.email}</p><span className="online-label">Rôle administrateur vérifié côté serveur</span></div></div></div>}
          </main>
        </div>
      )}

      {authOpen&&<AuthModal authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} fullName={fullName} setFullName={setFullName} phone={phone} setPhone={setPhone} authBusy={authBusy} error={error} onSubmit={handleAuth} onClose={()=>setAuthOpen(false)}/>}{signupConfirmationEmail&&<Modal title="Vérifiez votre boîte e-mail" onClose={()=>setSignupConfirmationEmail("")}><div className="email-confirm-card"><div className="email-confirm-icon"><CheckCircle2 size={30}/></div><h3>Encore une petite étape !</h3><p>Votre compte Skynet Wi-Fi a été créé. Nous venons de vous envoyer un e-mail de confirmation à :</p><strong className="email-confirm-address">{signupConfirmationEmail}</strong><p>Ouvrez cet e-mail et cliquez sur le bouton <b>Confirmer mon adresse e-mail</b> pour activer votre compte. Pensez aussi à vérifier vos courriers indésirables (Spam).</p><button className="button button-primary full-button" disabled={resendBusy} onClick={resendSignupConfirmation}>{resendBusy?"Envoi en cours…":"Renvoyer l’e-mail de confirmation"}</button><p className="field-help">Vous pourrez vous connecter après avoir confirmé votre adresse.</p></div></Modal>}
      {paymentOpen&&chosenPlan&&<Modal title="Demande de paiement" onClose={()=>setPaymentOpen(false)}><form onSubmit={submitPayment}><p className="modal-lead">{chosenPlan.name} · {formatDuration(chosenPlan.duration_seconds)} · <b>{money(Number(chosenPlan.price)*(1-customerDiscount.percent/100),chosenPlan.currency)}</b>{customerDiscount.percent>0&&<small> (rabais de {customerDiscount.percent}% inclus)</small>}</p><label className="field-label">Votre numéro de téléphone</label><input className="field-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Ex. 4077 0000" inputMode="tel" required/><label className="field-label">Choisissez votre moyen de paiement</label><div className="payment-method-choices" role="radiogroup" aria-label="Moyen de paiement"><button type="button" role="radio" aria-checked={paymentMethod==="moncash"} className={`payment-method-choice moncash-choice ${paymentMethod==="moncash"?"selected":""}`} onClick={()=>setPaymentMethod("moncash")}><span className="payment-brand-logo moncash-brand"><span className="moncash-symbol">▶</span><span className="moncash-wordmark"><b>MON</b><strong>Cash</strong></span></span><span className="payment-choice-caption">MonCash</span>{paymentMethod==="moncash"&&<CheckCircle2 size={18} className="payment-choice-check"/>}</button><button type="button" role="radio" aria-checked={paymentMethod==="natcash"} className={`payment-method-choice natcash-choice ${paymentMethod==="natcash"?"selected":""}`} onClick={()=>setPaymentMethod("natcash")}><span className="payment-brand-logo natcash-brand"><span className="natcash-wordmark"><b>nat</b><strong>cash</strong></span></span><span className="payment-choice-caption">NatCash</span>{paymentMethod==="natcash"&&<CheckCircle2 size={18} className="payment-choice-check"/>}</button></div><p className="field-help">Après avoir choisi votre logo, vous serez redirigé vers le paiement sécurisé. Votre ticket Wi-Fi sera créé automatiquement après confirmation.</p><button className="button button-primary full-button" disabled={busy}>{busy?"Traitement…":"Continuer avec "+(paymentMethod==="moncash"?"MonCash":"NatCash")} <ArrowRight size={16}/></button></form></Modal>}
      {issuedCode&&<Modal title="Ticket créé" onClose={()=>setIssuedCode("")}><p className="modal-lead">Copiez et conservez ce code. Il ne sera pas réaffiché après fermeture.</p><div className="issued-code">{issuedCode}</div><button className="button button-primary full-button" onClick={()=>navigator.clipboard?.writeText(issuedCode).then(()=>notify("Code copié."))}>Copier le code</button></Modal>}
      {notice&&<Toast message={notice} onClose={()=>setNotice("")}/>}
      {error&&<div className="toast error-toast"><X size={17}/>{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}
    </div>
  );
}

function Stat({icon,label,value,note,tone}:{icon:React.ReactNode;label:string;value:string|number;note:string;tone:string}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
function Status({value}:{value:string}) { return <span className={`record-status status-${value}`}>{statusLabel(value)}</span>; }
function Toast({message,onClose}:{message:string;onClose:()=>void}) { return <div className="toast"><CheckCircle2 size={18}/>{message}<button onClick={onClose}><X size={15}/></button></div>; }
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-card"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19}/></button></div>{children}</div></div>;
}
function AuthModal(props:{
  authMode:"login"|"signup";setAuthMode:(v:"login"|"signup")=>void;authEmail:string;setAuthEmail:(v:string)=>void;
  authPassword:string;setAuthPassword:(v:string)=>void;fullName:string;setFullName:(v:string)=>void;
  phone:string;setPhone:(v:string)=>void;authBusy:boolean;error:string;
  onSubmit:(e:React.FormEvent)=>void;onClose:()=>void;
}) {
  return <Modal title={props.authMode==="login"?"Connexion":"Créer un compte"} onClose={props.onClose}><form onSubmit={props.onSubmit}>
    {props.authMode==="signup"&&<><label className="field-label">Nom complet</label><input className="field-input" value={props.fullName} onChange={e=>props.setFullName(e.target.value)} required/><label className="field-label">Téléphone</label><input className="field-input" value={props.phone} onChange={e=>props.setPhone(e.target.value)} inputMode="tel" required/></>}
    <label className="field-label">Adresse e-mail</label><input className="field-input" type="email" value={props.authEmail} onChange={e=>props.setAuthEmail(e.target.value)} required/>
    <label className="field-label">Mot de passe</label><input className="field-input" type="password" minLength={8} value={props.authPassword} onChange={e=>props.setAuthPassword(e.target.value)} required/>
    {props.error&&<p className="field-error">{props.error}</p>}
    <button className="button button-primary full-button" disabled={props.authBusy}>{props.authBusy?"Veuillez patienter…":props.authMode==="login"?"Se connecter":"Créer mon compte"}</button>
    <p className="field-help">{props.authMode==="login"?"Vous n’avez pas de compte ?":"Vous avez déjà un compte ?"} <button type="button" className="inline-link" onClick={()=>props.setAuthMode(props.authMode==="login"?"signup":"login")}>{props.authMode==="login"?"Créer un compte":"Se connecter"}</button></p>
  </form></Modal>;
}
function PlanEditor({plan,busy,onSave}:{plan:Plan;busy:boolean;onSave:(p:Plan,v:string)=>void;onRefresh:()=>void}) {
  const [price,setPrice]=useState(plan.price==null?"":String(plan.price));
  useEffect(()=>setPrice(plan.price==null?"":String(plan.price)),[plan.price]);
  return <div className="admin-plan-card plan-editor"><div className="plan-icon"><Clock3/></div><div className="plan-editor-info"><b>{plan.name}</b><small>{formatDuration(plan.duration_seconds)} · {plan.code}</small></div><div className="plan-price-edit"><input type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Prix HTG"/><span>{plan.currency}</span></div><button className="button button-primary" disabled={busy} onClick={()=>onSave(plan,price)}>Enregistrer</button><span className={plan.is_active?"online-label":"offline-label"}>{plan.is_active?"Actif":"Inactif"}</span></div>;
}
