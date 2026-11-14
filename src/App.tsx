import { useState } from "react";
import {
  Activity, ArrowRight, CalendarClock, Check, CheckCircle2,
  Clock3, CreditCard, Gauge, Globe2, LayoutDashboard, LifeBuoy,
  LockKeyhole, Menu, MoreHorizontal, Plus, Radio,
  Search, Settings, ShieldCheck, Signal, Ticket, Users, Wallet,
  Wifi, X, Zap,
} from "lucide-react";

type Plan = { id: string; name: string; duration: string; price: string; detail: string; popular?: boolean; };
type Section = "overview" | "customers" | "tickets" | "payments" | "plans" | "settings";

const plans: Plan[] = [
  { id: "hour", name: "1 heure", duration: "60 minutes", price: "—", detail: "Pour une connexion rapide" },
  { id: "day", name: "1 jour", duration: "24 heures", price: "—", detail: "Idéal pour une journée" },
  { id: "week", name: "7 jours", duration: "7 jours", price: "—", detail: "Une semaine complète", popular: true },
  { id: "fortnight", name: "15 jours", duration: "15 jours", price: "—", detail: "Pour rester connecté" },
  { id: "month", name: "30 jours", duration: "30 jours", price: "—", detail: "Notre formule longue durée" },
];

const navItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { id: "customers", label: "Clients", icon: Users },
  { id: "tickets", label: "Tickets Wi-Fi", icon: Ticket },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "plans", label: "Forfaits", icon: Wallet },
  { id: "settings", label: "Paramètres", icon: Settings },
];

function Brand() {
  return <div className="brand"><div className="brand-mark"><Wifi size={21} strokeWidth={2.7} /></div><div><strong>skynet<span> wi-fi</span></strong><small>INTERNET • PARTOUT</small></div></div>;
}

function App() {
  const [mode, setMode] = useState<"customer" | "admin">("customer");
  const [section, setSection] = useState<Section>("overview");
  const [selectedPlan, setSelectedPlan] = useState("week");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [phone, setPhone] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("7 derniers jours");

  const title = navItems.find((item) => item.id === section)?.label ?? "Vue d’ensemble";

  const submitDemo = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <span className="network-pill"><span className="live-dot" /> Réseau disponible</span>
          <button className="mode-switch" onClick={() => { setMode(mode === "customer" ? "admin" : "customer"); setSection("overview"); }}>
            {mode === "customer" ? <><LayoutDashboard size={16} /> Espace admin</> : <><Globe2 size={16} /> Portail client</>}
          </button>
        </div>
      </header>

      {mode === "customer" ? (
        <main className="customer-page">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> INTERNET HAUT DÉBIT À GONAÏVES</div>
              <h1>Le Wi-Fi qui vous<br /><em>connecte au monde.</em></h1>
              <p>Une connexion simple, rapide et accessible. Choisissez votre forfait et profitez d’Internet avec Skynet Wi-Fi.</p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={() => setShowBuy(true)}>Choisir un forfait <ArrowRight size={17} /></button>
                <button className="button button-ghost" onClick={() => setShowLogin(true)}><Ticket size={17} /> J’ai déjà un ticket</button>
              </div>
              <div className="hero-trust"><span><ShieldCheck size={16} /> Accès sécurisé</span><span><Zap size={16} /> Activation rapide</span></div>
            </div>
            <div className="hero-art" aria-label="Illustration du réseau Wi-Fi">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="signal-core"><Wifi size={66} strokeWidth={1.45} /></div>
              <div className="float-card float-speed"><Gauge size={17} /><div><b>Haut débit</b><small>Connexion fluide</small></div></div>
              <div className="float-card float-status"><span className="live-dot" /><div><b>Réseau actif</b><small>Skynet Wi-Fi</small></div></div>
              <div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✧</div>
            </div>
          </section>

          <section className="plans-section" id="forfaits">
            <div className="section-heading"><div><div className="eyebrow">NOS OFFRES</div><h2>Choisissez votre connexion</h2><p>Des forfaits adaptés à votre rythme.</p></div><span className="no-price-note">Tarifs communiqués au point de vente</span></div>
            <div className="plan-grid">
              {plans.map((plan) => <button key={plan.id} className={`plan-card ${selectedPlan === plan.id ? "selected" : ""}`} onClick={() => setSelectedPlan(plan.id)}>
                {plan.popular && <span className="popular-tag">POPULAIRE</span>}
                <span className="plan-icon"><Clock3 size={21} /></span>
                <strong>{plan.name}</strong><span className="plan-duration">{plan.duration}</span><p>{plan.detail}</p>
                <span className="plan-select">{selectedPlan === plan.id ? <><Check size={14} /> Sélectionné</> : "Choisir ce forfait"}</span>
              </button>)}
            </div>
            <div className="purchase-strip"><div className="purchase-icon"><Ticket size={22} /></div><div><b>Prêt à vous connecter ?</b><span>Choisissez un forfait pour commencer votre achat.</span></div><button className="button button-primary" onClick={() => setShowBuy(true)}>Continuer <ArrowRight size={16} /></button></div>
          </section>

          <section className="how-section">
            <div className="section-heading centered"><div className="eyebrow">C’EST SIMPLE</div><h2>Connectez-vous en 3 étapes</h2></div>
            <div className="steps-grid"><div className="step"><span>01</span><div className="step-icon"><Signal /></div><b>Connectez-vous</b><p>Choisissez le réseau Wi-Fi Skynet sur votre téléphone ou ordinateur.</p></div><div className="step"><span>02</span><div className="step-icon"><CreditCard /></div><b>Choisissez un forfait</b><p>Sélectionnez la durée qui vous convient et suivez les instructions de paiement.</p></div><div className="step"><span>03</span><div className="step-icon"><Zap /></div><b>Profitez d’Internet</b><p>Entrez votre ticket et profitez de votre connexion Skynet Wi-Fi.</p></div></div>
          </section>
          <footer className="footer"><Brand /><span>© {new Date().getFullYear()} Skynet Wi-Fi. Tous droits réservés.</span><button onClick={() => submitDemo("Le support sera bientôt disponible.")}><LifeBuoy size={15} /> Assistance</button></footer>
        </main>
      ) : (
        <div className="admin-layout">
          <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
            <div className="sidebar-brand"><Brand /><button className="icon-button mobile-only" onClick={() => setMenuOpen(false)}><X /></button></div>
            <div className="side-label">MENU PRINCIPAL</div>
            <nav>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${section === item.id ? "active" : ""}`} onClick={() => { setSection(item.id); setMenuOpen(false); }}><Icon size={18} /><span>{item.label}</span>{item.id === "payments" && <i className="nav-count">3</i>}</button>; })}</nav>
            <div className="sidebar-bottom"><div className="router-status"><span className="live-dot" /><div><b>MikroTik</b><small>À configurer</small></div><span className="status-tag">HORS LIGNE</span></div><div className="admin-profile"><div className="avatar">A</div><div><b>Administrateur</b><small>Gestionnaire</small></div><MoreHorizontal size={18} /></div></div>
          </aside>
          <main className="admin-main">
            <div className="admin-header"><button className="icon-button mobile-only" onClick={() => setMenuOpen(true)}><Menu /></button><div><div className="breadcrumb">Skynet Wi-Fi <span>/</span> {title}</div><h1>{title}</h1></div><div className="admin-header-actions"><span className="date-label"><CalendarClock size={16} /> {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span><button className="admin-avatar">A</button></div></div>
            {section === "overview" && <div className="dashboard-content">
              <div className="welcome-row"><div><h2>Bonjour, Administrateur 👋</h2><p>Voici un aperçu de votre activité réseau.</p></div><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>7 derniers jours</option><option>30 derniers jours</option><option>Cette année</option></select></div>
              <div className="stats-grid"><Stat icon={<Users />} label="Clients actifs" value="—" note="En attente du MikroTik" tone="blue" /><Stat icon={<Ticket />} label="Tickets vendus" value="—" note="Aucune donnée connectée" tone="purple" /><Stat icon={<Wallet />} label="Revenus" value="—" note="À connecter aux paiements" tone="green" /><Stat icon={<Activity />} label="Appareils connectés" value="—" note="Routeur non configuré" tone="orange" /></div>
              <div className="dashboard-grid"><div className="panel activity-panel"><div className="panel-heading"><div><h3>Activité du réseau</h3><p>État de la connexion MikroTik</p></div><span className="offline-label"><span /> Hors ligne</span></div><div className="empty-chart"><div className="chart-icon"><Radio size={28} /></div><b>En attente de connexion</b><p>Les statistiques apparaîtront ici une fois le routeur MikroTik connecté.</p></div></div><div className="panel quick-panel"><div className="panel-heading"><div><h3>Actions rapides</h3><p>Gérez votre hotspot</p></div></div><button onClick={() => setSection("tickets")}><span className="quick-icon violet"><Plus /></span><span><b>Créer un ticket</b><small>Générer un accès Wi-Fi</small></span><ArrowRight size={16} /></button><button onClick={() => setSection("payments")}><span className="quick-icon green"><CreditCard /></span><span><b>Vérifier les paiements</b><small>Examiner les demandes</small></span><ArrowRight size={16} /></button><button onClick={() => setSection("plans")}><span className="quick-icon blue"><Wallet /></span><span><b>Gérer les forfaits</b><small>Durées et tarifs</small></span><ArrowRight size={16} /></button></div></div>
              <div className="panel table-panel"><div className="panel-heading"><div><h3>Dernières activités</h3><p>Les opérations récentes apparaîtront ici.</p></div><button className="text-button" onClick={() => setSection("tickets")}>Voir les tickets <ArrowRight size={15} /></button></div><div className="empty-table"><Ticket size={22} /><span>Aucune activité pour le moment</span></div></div>
              <div className="demo-note"><ShieldCheck size={17} /><span><b>Mode préparation :</b> les chiffres réels seront affichés après la connexion de Supabase et du routeur MikroTik. Aucune donnée fictive n’est utilisée.</span></div>
            </div>}
            {section === "customers" && <div className="dashboard-content"><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="button button-primary" onClick={() => submitDemo("La création de client sera disponible après connexion de la base de données.")}><Plus size={16} /> Ajouter un client</button></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Liste des clients</h3><p>Les comptes clients seront chargés depuis Supabase.</p></div><span className="count-chip">0 client</span></div><div className="empty-table"><Users size={22} /><span>Aucun client enregistré pour le moment</span></div></div></div>}
            {section === "tickets" && <div className="dashboard-content"><div className="section-intro"><div><h2>Gestion des tickets</h2><p>Créez et gérez les codes d’accès à votre réseau Wi-Fi.</p></div><button className="button button-primary" onClick={() => submitDemo("La génération de tickets sera activée après l’intégration MikroTik.")}><Plus size={16} /> Générer un ticket</button></div><div className="stats-grid compact-stats"><Stat icon={<Ticket />} label="Tickets créés" value="0" note="Aucun ticket" tone="purple" /><Stat icon={<CheckCircle2 />} label="Actifs" value="0" note="Aucun accès actif" tone="green" /><Stat icon={<Clock3 />} label="Expirés" value="0" note="Aucune expiration" tone="orange" /></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Tickets récents</h3><p>Codes et durée de validité</p></div></div><div className="empty-table"><Ticket size={22} /><span>Aucun ticket créé</span></div></div></div>}
            {section === "payments" && <div className="dashboard-content"><div className="section-intro"><div><h2>Suivi des paiements</h2><p>Confirmez les paiements avant d’activer les tickets.</p></div><span className="pending-chip">0 en attente</span></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Transactions</h3><p>Les paiements seront synchronisés avec le backend.</p></div></div><div className="empty-table"><CreditCard size={22} /><span>Aucun paiement à afficher</span></div></div><div className="demo-note"><LockKeyhole size={17} /><span>Un ticket ne sera jamais activé sur la seule base d’une redirection du navigateur. La confirmation devra être vérifiée côté serveur.</span></div></div>}
            {section === "plans" && <div className="dashboard-content"><div className="section-intro"><div><h2>Forfaits Wi-Fi</h2><p>Les tarifs et limites seront configurables depuis cet espace.</p></div><button className="button button-primary" onClick={() => submitDemo("L’édition des forfaits sera activée avec Supabase.")}><Plus size={16} /> Nouveau forfait</button></div><div className="admin-plans">{plans.map((plan) => <div className="admin-plan-card" key={plan.id}><div className="plan-icon"><Clock3 /></div><div><b>{plan.name}</b><small>{plan.duration}</small></div><span className="plan-price">Tarif à définir</span><button className="icon-button" onClick={() => submitDemo("L’édition sera disponible après connexion de la base de données.")}><Settings size={17} /></button></div>)}</div></div>}
            {section === "settings" && <div className="dashboard-content"><div className="section-intro"><div><h2>Paramètres du système</h2><p>Configuration des services et du réseau.</p></div></div><div className="settings-grid"><div className="panel setting-card"><div className="setting-icon"><Radio /></div><h3>Routeur MikroTik</h3><p>Connexion sécurisée au routeur HotSpot.</p><span className="offline-label"><span /> Non configuré</span><button className="button button-outline" onClick={() => submitDemo("La configuration MikroTik sera faite depuis le backend sécurisé.")}>Configurer plus tard</button></div><div className="panel setting-card"><div className="setting-icon"><Globe2 /></div><h3>Portail client</h3><p>Adresse et paramètres du portail captif.</p><span className="pending-chip">En préparation</span></div><div className="panel setting-card"><div className="setting-icon"><ShieldCheck /></div><h3>Sécurité</h3><p>Accès administrateur et journal des actions.</p><span className="pending-chip">À configurer</span></div></div></div>}
          </main>
        </div>
      )}

      {showBuy && <Modal title="Choisir votre forfait" onClose={() => setShowBuy(false)}><p className="modal-lead">Sélectionnez la durée de connexion souhaitée.</p><div className="modal-plan-list">{plans.map((plan) => <button key={plan.id} className={`modal-plan ${selectedPlan === plan.id ? "chosen" : ""}`} onClick={() => setSelectedPlan(plan.id)}><span><b>{plan.name}</b><small>{plan.detail}</small></span><span>{selectedPlan === plan.id ? <CheckCircle2 size={19} /> : <span className="radio-empty" />}</span></button>)}</div><label className="field-label">Votre numéro de téléphone</label><input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex. 4077 0000" inputMode="tel" /><p className="field-help">Le tarif et les moyens de paiement seront affichés après configuration par l’administrateur.</p><button className="button button-primary full-button" onClick={() => { setShowBuy(false); submitDemo("Le catalogue est prêt. Les paiements seront activés après configuration."); }}>Continuer <ArrowRight size={16} /></button></Modal>}
      {showLogin && <Modal title="Accéder à Internet" onClose={() => setShowLogin(false)}><p className="modal-lead">Entrez le code de votre ticket Skynet Wi-Fi.</p><label className="field-label">Code du ticket</label><input className="field-input ticket-input" value={ticketCode} onChange={(e) => setTicketCode(e.target.value.toUpperCase())} placeholder="EX. SKY-XXXXXX" /><button className="button button-primary full-button" onClick={() => { setShowLogin(false); submitDemo(ticketCode.trim() ? "Le système de validation sera activé avec le routeur MikroTik." : "Veuillez entrer le code de votre ticket."); }}>Se connecter <ArrowRight size={16} /></button><p className="field-help">Vous n’avez pas encore de ticket ? <button className="inline-link" onClick={() => { setShowLogin(false); setShowBuy(true); }}>Acheter un forfait</button></p></Modal>}
      {notice && <div className="toast"><CheckCircle2 size={18} /> {notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}
    </div>
  );
}

function Stat({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-card"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></div>{children}</div></div>;
}

export default App;
