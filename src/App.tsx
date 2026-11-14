import { useEffect, useMemo, useState } from "react";

import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import {
  ArrowRight, CalendarClock, Check, CheckCircle2, Clock3,
  CreditCard, Gauge, Globe2, LayoutDashboard, LockKeyhole,
  LogOut, Menu, Plus, Radio, RefreshCw, Search, Settings, ShieldCheck,
  Signal, Ticket, Users, Wallet, Wifi, X, Zap, Ban,
} from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL || "https://skynetht-wifi-api.onrender.com").replace(/\/$/, "");
const AUTH_REDIRECT_URL = "https://skynetht-wifi.vercel.app";
type Section = "overview" | "customers" | "tickets" | "payments" | "plans" | "settings";
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
  return <div className="brand"><div className="brand-mark"><Wifi size={21} strokeWidth={2.7} /></div><div><strong>skynet<span> wi-fi</span></strong><small>INTERNET • PARTOUT</small></div></div>;
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

  const notify = (message: string) => { setNotice(message); setError(""); };
  const fail = (message: string) => { setError(message); setNotice(""); };

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { setProfile(null); setMode("customer"); }
    });
    fetch(`${API_URL}/health`).then((r) => r.ok ? r.json() : Promise.reject()).then(() => alive && setApiHealth("online")).catch(() => alive && setApiHealth("offline"));
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadProfile() {
      if (!session) { setProfile(null); return; }
      try {
        const result = await api<{ user: { id: string; email: string }; profile: Profile | null }>("/api/me");
        if (alive) setProfile({ ...(result.profile || { id: result.user.id, full_name: null, phone: null, role: "customer" }), email: result.user.email });
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
      const [s, c, p, t, pl] = await Promise.all([
        api<Summary>("/api/admin/summary"),
        api<{ customers: Profile[] }>("/api/admin/customers"),
        api<{ payments: Payment[] }>("/api/admin/payments"),
        api<{ tickets: WifiTicket[] }>("/api/admin/tickets"),
        api<{ plans: Plan[] }>("/api/admin/plans"),
      ]);
      setSummary(s); setCustomers(c.customers); setPayments(p.payments); setTickets(t.tickets); setAdminPlans(pl.plans);
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
  const canOpenAdminDashboard = profile?.role === "admin" && profile.email?.trim().toLowerCase() === "nesleyestime1@gmail.com";
  const openAdminDashboard = () => {
    if (!canOpenAdminDashboard) return;
    window.history.pushState({}, "", "/admin");
    setSection("overview");
    setMode("admin");
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

  const handleSignOut = async () => { await supabase.auth.signOut(); setMode("customer"); setSection("overview"); notify("Vous êtes déconnecté."); };
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
          {mode === "customer" && canOpenAdminDashboard && <button className="mode-switch" onClick={openAdminDashboard}><LayoutDashboard size={16} /> Dashboard</button>}
          {mode === "admin" && <button className="mode-switch" onClick={() => { window.history.pushState({}, "", "/"); setMode("customer"); }}><Globe2 size={16} /> Portail client</button>}
          {session && <button className="mode-switch" onClick={handleSignOut}><LogOut size={15}/> Déconnexion</button>}
        </div>
      </header>

      {mode === "customer" ? (
        <main className="customer-page">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> INTERNET HAUT DÉBIT À GONAÏVES</div>
              <h1>Le Wi-Fi qui vous<br/><em>connecte au monde.</em></h1>
              <p>Une connexion simple, rapide et accessible. Choisissez votre forfait et profitez d’Internet avec Skynet Wi-Fi.</p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={()=>document.getElementById("forfaits")?.scrollIntoView({behavior:"smooth"})}>Voir les forfaits <ArrowRight size={17}/></button>
                {!session ? <button className="button button-ghost" onClick={()=>openAuth("customer")}>Créer un compte / Connexion</button> : <button className="button button-ghost" onClick={()=>document.getElementById("profil-client")?.scrollIntoView({behavior:"smooth"})}>Mon profil : {profile?.full_name || session.user.email}</button>}
              </div>
              <div className="hero-trust"><span><ShieldCheck size={16}/> Paiements vérifiés</span><span><Zap size={16}/> Ticket après confirmation</span></div>
            </div>
            <div className="hero-art" aria-label="Illustration du réseau Wi-Fi"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="signal-core"><Wifi size={66} strokeWidth={1.45}/></div><div className="float-card float-speed"><Gauge size={17}/><div><b>Forfaits flexibles</b><small>Selon votre besoin</small></div></div><div className="float-card float-status"><span className="live-dot" style={{background:"#d58b47"}}/><div><b>Routeur à installer</b><small>Activation après installation</small></div></div><div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✧</div></div>
          </section>

          <section className="plans-section" id="forfaits">
            <div className="section-heading"><div><div className="eyebrow">NOS OFFRES</div><h2>Choisissez votre connexion</h2><p>Les prix affichés proviennent directement du catalogue Skynet Wi-Fi.</p></div><span className="no-price-note">{catalogLoading?"Chargement des forfaits":catalogError?"Catalogue indisponible":"Forfaits synchronisés"}</span></div>
            {catalogError ? <div className="panel error-panel">{catalogError} <button className="button button-outline" onClick={loadPlans}>Réessayer</button></div> : catalogLoading ? <div className="panel empty-table">Chargement des forfaits…</div> : activePlans.length === 0 ? <div className="panel empty-table">Aucun forfait actif pour le moment.</div> : <div className="plan-grid">
              {activePlans.map((plan)=><button key={plan.id} className={`plan-card ${selectedPlan===plan.id?"selected":""}`} onClick={()=>setSelectedPlan(plan.id)}>
                {plan.code==="SKY-7D"&&<span className="popular-tag">POPULAIRE</span>}
                <span className="plan-icon"><Clock3 size={21}/></span><strong>{plan.name}</strong><span className="plan-duration">{formatDuration(plan.duration_seconds)}</span><p className={`plan-price ${plan.price==null?"pending":""}`}>{plan.price==null?"Tarif en attente de validation":money(plan.price,plan.currency)}</p><span className="plan-select">{selectedPlan===plan.id?<><Check size={14}/> Sélectionné</>:"Choisir ce forfait"}</span>
              </button>)}
            </div>}
            <div className="purchase-strip"><div className="purchase-icon"><Ticket size={22}/></div><div><b>Prêt à faire votre demande ?</b><span>Un ticket est délivré après vérification du paiement.</span></div><button className="button button-primary" disabled={!chosenPlan||chosenPlan.price==null||Number(chosenPlan.price)<=0} onClick={startPurchase}>Continuer <ArrowRight size={16}/></button></div>
            {session&&<section className="my-records">
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
          <section className="how-section"><div className="section-heading centered"><div className="eyebrow">C’EST SIMPLE</div><h2>Connectez-vous en 3 étapes</h2></div><div className="steps-grid"><div className="step"><span>01</span><div className="step-icon"><Signal/></div><b>Choisissez un forfait</b><p>Sélectionnez une durée et créez votre demande de paiement.</p></div><div className="step"><span>02</span><div className="step-icon"><CreditCard/></div><b>Faites le paiement</b><p>Effectuez le paiement selon le moyen choisi et conservez la référence.</p></div><div className="step"><span>03</span><div className="step-icon"><Ticket/></div><b>Recevez votre ticket</b><p>Après vérification par Skynet, votre code de connexion sera créé.</p></div></div></section>
          <footer className="footer"><Brand/><span>© {new Date().getFullYear()} Skynet Wi-Fi. Tous droits réservés.</span><span>Support : contactez l’administrateur du réseau.</span></footer>
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
            {section==="payments"&&<div className="dashboard-content"><div className="section-intro"><div><h2>Suivi des paiements</h2><p>Vérifiez la réception effective avant toute confirmation.</p></div><span className="pending-chip">{payments.filter(p=>p.status==="pending").length} en attente</span></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Transactions</h3><p>Demandes réelles enregistrées par les clients.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Référence / Client</th><th>Forfait</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td><b>{p.customer_phone||"Client"}</b><small>{p.payment_reference||p.id}</small></td><td>{p.wifi_plans?.name||"—"}</td><td>{money(Number(p.amount),p.currency)}</td><td>{paymentLabel(p.payment_method)}</td><td><Status value={p.status}/></td><td>{date(p.created_at)}</td><td>{p.status==="pending"&&p.provider_payload?.provider==="tranzak"?<small>Confirmation automatique Tranzak</small>:p.status==="pending"?<div className="table-actions"><button className="confirm-action" title="Confirmer et créer le ticket" disabled={busy} onClick={()=>confirmPayment(p.id)}><Check size={15}/></button><button title="Refuser" disabled={busy} onClick={()=>rejectPayment(p.id)}><X size={15}/></button></div>:"—"}</td></tr>)}</tbody></table>{payments.length===0&&<div className="empty-table"><CreditCard/><span>Aucune demande de paiement enregistrée.</span></div>}</div></div></div>}
            {section==="plans"&&<div className="dashboard-content"><div className="section-intro"><div><h2>Forfaits Wi-Fi</h2><p>Modifiez les prix et activez ou désactivez les offres.</p></div></div><div className="admin-plans live-admin-plans">{adminPlans.map(plan=><PlanEditor key={plan.id} plan={plan} busy={busy} onSave={savePlan} onRefresh={loadAdmin}/>)}</div></div>}
            {section==="settings"&&<div className="dashboard-content"><div className="section-intro"><div><h2>Paramètres du système</h2><p>État des services réellement configurés.</p></div></div><div className="settings-grid"><div className="panel setting-card"><div className="setting-icon"><Radio/></div><h3>Routeur MikroTik</h3><p>Le routeur n’a pas encore été acheté ni connecté.</p><span className="offline-label"><span/> {routerStatus}</span></div><div className="panel setting-card"><div className="setting-icon"><Globe2/></div><h3>API Skynet Wi-Fi</h3><p>Service backend hébergé sur Render.</p><span className={apiHealth==="online"?"online-label":"offline-label"}>{apiHealth==="online"?"Disponible":apiHealth==="offline"?"Indisponible":"Vérification"}</span></div><div className="panel setting-card"><div className="setting-icon"><ShieldCheck/></div><h3>Compte administrateur</h3><p>{profile?.email}</p><span className="online-label">Rôle administrateur vérifié côté serveur</span></div></div></div>}
          </main>
        </div>
      )}

      {authOpen&&<AuthModal authMode={authMode} setAuthMode={setAuthMode} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} fullName={fullName} setFullName={setFullName} phone={phone} setPhone={setPhone} authBusy={authBusy} error={error} onSubmit={handleAuth} onClose={()=>setAuthOpen(false)}/>}{signupConfirmationEmail&&<Modal title="Vérifiez votre boîte e-mail" onClose={()=>setSignupConfirmationEmail("")}><div className="email-confirm-card"><div className="email-confirm-icon"><CheckCircle2 size={30}/></div><h3>Encore une petite étape !</h3><p>Votre compte Skynet Wi-Fi a été créé. Nous venons de vous envoyer un e-mail de confirmation à :</p><strong className="email-confirm-address">{signupConfirmationEmail}</strong><p>Ouvrez cet e-mail et cliquez sur le bouton <b>Confirmer mon adresse e-mail</b> pour activer votre compte. Pensez aussi à vérifier vos courriers indésirables (Spam).</p><button className="button button-primary full-button" disabled={resendBusy} onClick={resendSignupConfirmation}>{resendBusy?"Envoi en cours…":"Renvoyer l’e-mail de confirmation"}</button><p className="field-help">Vous pourrez vous connecter après avoir confirmé votre adresse.</p></div></Modal>}
      {paymentOpen&&chosenPlan&&<Modal title="Demande de paiement" onClose={()=>setPaymentOpen(false)}><form onSubmit={submitPayment}><p className="modal-lead">{chosenPlan.name} · {formatDuration(chosenPlan.duration_seconds)} · <b>{money(chosenPlan.price,chosenPlan.currency)}</b></p><label className="field-label">Votre numéro de téléphone</label><input className="field-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Ex. 4077 0000" inputMode="tel" required/><label className="field-label">Choisissez votre moyen de paiement</label><div className="payment-method-choices" role="radiogroup" aria-label="Moyen de paiement"><button type="button" role="radio" aria-checked={paymentMethod==="moncash"} className={`payment-method-choice moncash-choice ${paymentMethod==="moncash"?"selected":""}`} onClick={()=>setPaymentMethod("moncash")}><span className="payment-brand-logo moncash-brand"><span className="moncash-symbol">▶</span><span className="moncash-wordmark"><b>MON</b><strong>Cash</strong></span></span><span className="payment-choice-caption">MonCash</span>{paymentMethod==="moncash"&&<CheckCircle2 size={18} className="payment-choice-check"/>}</button><button type="button" role="radio" aria-checked={paymentMethod==="natcash"} className={`payment-method-choice natcash-choice ${paymentMethod==="natcash"?"selected":""}`} onClick={()=>setPaymentMethod("natcash")}><span className="payment-brand-logo natcash-brand"><span className="natcash-wordmark"><b>nat</b><strong>cash</strong></span></span><span className="payment-choice-caption">NatCash</span>{paymentMethod==="natcash"&&<CheckCircle2 size={18} className="payment-choice-check"/>}</button></div><p className="field-help">Après avoir choisi votre logo, vous serez redirigé vers le paiement sécurisé. Votre ticket Wi-Fi sera créé automatiquement après confirmation.</p><button className="button button-primary full-button" disabled={busy}>{busy?"Traitement…":"Continuer avec "+(paymentMethod==="moncash"?"MonCash":"NatCash")} <ArrowRight size={16}/></button></form></Modal>}
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
