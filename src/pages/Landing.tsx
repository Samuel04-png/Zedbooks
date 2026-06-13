import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Briefcase,
  Shield,
  BarChart3,
  Check,
  ArrowRight,
  Download,
  Building2,
  Clock,
  TrendingUp,
  Globe,
  Quote,
  MapPin,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { useEffect, useState } from "react";
import { ByteBerryWatermark } from "@/components/common/ByteBerryWatermark";
import { Logo } from "@/components/common/Logo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

const demoHref =
  "https://wa.me/260760580949?text=Hi%20Byte%20%26%20Berry%2C%20I%20want%20to%20book%20a%20ZedBooks%20demo%20for%20our%20NGO%20finance%20team.";

const features = [
  {
    icon: Users,
    title: "Employee Management",
    description: "Complete database with role-based access control and history tracking.",
    painPoint: "Stop chasing paper employee records across departments.",
  },
  {
    icon: Briefcase,
    title: "Payroll Processing",
    description: "Automated calculations for PAYE, NAPSA, and NHIMA with one-click rendering.",
    painPoint: "End the monthly scramble — payroll that just works with Zambian statutory deductions built in.",
  },
  {
    icon: Shield,
    title: "Compliance & Audit",
    description: "Built-in ZRA compliance rules and detailed audit logs for every action.",
    painPoint: "No more last-minute panic before ZRA submissions. Every transaction traceable.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Live financial dashboards and customizable reports for better decision making.",
    painPoint: "Know where every kwacha is — grants, payroll, expenses — without waiting for month-end.",
  },
];

const testimonials = [
  {
    quote: "We used to spend the first week of every month just reconciling our grant accounts. ZedBooks cut that to a single afternoon.",
    role: "Finance Manager",
    org: "Lusaka-based NGO",
    initials: "MK",
  },
  {
    quote: "The compliance features alone saved us from a ZRA penalty. NAPSA, NHIMA, PAYE — all calculated and submitted from one dashboard.",
    role: "Head of Finance",
    org: "Copperbelt Health NGO",
    initials: "BT",
  },
];

const stats = [
  { value: "2,400+", label: "Employees managed" },
  { value: "K150M+", label: "Transaction volume" },
  { value: "99.7%", label: "Uptime" },
  { value: "4.8/5", label: "User satisfaction" },
];

export default function Landing() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted the install prompt");
        }
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden">
      {/* ===== NAVIGATION ===== */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
        <div className="container mx-auto px-4 lg:px-6 flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3">
            <Logo variant="full" size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#why" className="hover:text-slate-900 transition-colors">Why ZedBooks</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-slate-900 transition-colors">Testimonials</a>
            <a href="#compliance" className="hover:text-slate-900 transition-colors">Compliance</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:inline-flex text-slate-500 hover:text-slate-900 hover:bg-slate-50">
                Sign In
              </Button>
            </Link>
            <a href={demoHref} target="_blank" rel="noreferrer">
              <Button className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/15 px-6 transition-all hover:shadow-xl hover:-translate-y-0.5">
                Book a Demo
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative pt-16 pb-28 lg:pt-24 lg:pb-36 overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-50/60 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-50/40 rounded-full blur-[100px] -z-10" />

        <div className="container mx-auto px-4 lg:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* New badge */}
            <Badge variant="outline" className="mb-6 px-4 py-1.5 rounded-full bg-amber-50/60 text-amber-800 border-amber-200/60 inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>New: Automated ZRA Tax Submission</span>
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.08]">
              Financial peace of mind for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900">
                Zambian NGOs
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-500 mb-8 max-w-2xl mx-auto leading-relaxed">
              Payroll, compliance, grants, and reporting — built for how Zambian non-profits actually work. 
              No more spreadsheets, no more last-minute compliance scrambles.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <a href={demoHref} target="_blank" rel="noreferrer">
                <Button size="lg" className="h-14 px-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20 text-base font-semibold transition-all hover:shadow-2xl hover:-translate-y-0.5">
                  Book a Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-14 px-10 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 text-base transition-all">
                  Start Free Trial
                </Button>
              </Link>
            </div>

            {/* Trust bar */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 mb-8">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Free 14-day trial</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-blue-500" /> Built in Zambia, for Zambia</span>
            </div>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative max-w-5xl mx-auto mt-8">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden ring-1 ring-slate-900/5">
              <div className="h-11 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
                </div>
                <div className="mx-auto bg-slate-200/60 h-5 w-56 rounded text-[10px] flex items-center justify-center text-slate-400 font-mono">
                  app.zedbooks.com/dashboard
                </div>
              </div>
              <div className="grid grid-cols-12 gap-px bg-slate-100">
                <div className="col-span-2 hidden lg:flex flex-col gap-1 p-4 bg-white">
                  {['Dashboard', 'Payroll', 'Grants', 'Compliance', 'Reports'].map((item, index) => (
                    <div key={item} className={`rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                      index === 0 ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="col-span-12 lg:col-span-10 bg-white p-5 lg:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1">April Finance Close</p>
                      <h3 className="text-lg font-bold text-slate-900">NGO Finance Dashboard</h3>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">All Compliant</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Grant Balance</p>
                      <p className="text-xl font-bold text-slate-900">K842k</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">6 active grants</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Payroll Due</p>
                      <p className="text-xl font-bold text-slate-900">K156k</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">PAYE/NAPSA ready</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Pending</p>
                      <p className="text-xl font-bold text-slate-900">12</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Bills & expenses</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-slate-800">Compliance Timeline</p>
                      <p className="text-[10px] font-medium text-slate-400">Next 30 days</p>
                    </div>
                    <div className="space-y-2">
                      {[
                        ['ZRA Smart Invoice sync', 'Ready to submit', 'bg-emerald-50 text-emerald-700'],
                        ['NAPSA monthly return', 'Draft generated', 'bg-blue-50 text-blue-700'],
                        ['Board donor report', 'Needs approval', 'bg-amber-50 text-amber-700'],
                      ].map(([title, status, klass]) => (
                        <div key={title} className="flex items-center justify-between rounded-lg bg-white px-3.5 py-2.5 shadow-sm border border-slate-50">
                          <span className="text-sm font-medium text-slate-700">{title}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${klass}`}>{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BANNER ===== */}
      <section className="py-12 bg-slate-900 border-y border-slate-800">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl lg:text-4xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY ZEDBOOKS (Problem → Solution) ===== */}
      <section id="why" className="py-24 lg:py-32 bg-white">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <Badge variant="outline" className="mb-4 px-3 py-1 rounded-full text-slate-500 border-slate-200 text-xs">
              The problem we solve
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
              NGO finance shouldn't feel like a monthly crisis
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              If you're still running payroll across multiple spreadsheets, manually calculating NAPSA deductions, 
              or chasing compliance deadlines — you're not alone. But you don't have to stay there.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mb-5">
                <span className="text-red-500 text-lg font-bold">✕</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Before ZedBooks</h3>
              <ul className="space-y-3">
                {[
                  "Manual payroll with error-prone spreadsheets",
                  "Missed NAPSA/NHIMA deadlines and penalties",
                  "Grants and expenses scattered across email threads",
                  "Month-end close takes a week of overtime",
                  "Auditors asking for documents you can't find",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-500">
                    <span className="text-red-300 mt-0.5 shrink-0">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100">
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">With ZedBooks</h3>
              <ul className="space-y-3">
                {[
                  "One-click payroll with ZRA, NAPSA, NHIMA auto-calc",
                  "Automated compliance calendar — never miss a deadline",
                  "All grants, expenses, and approvals in one place",
                  "Month-end close in hours, not days",
                  "Audit trail on every transaction — ready when you are",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-24 lg:py-32 bg-slate-50">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4 px-3 py-1 rounded-full text-slate-500 border-slate-200 text-xs">
              Everything you need
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
              Built for Zambian compliance, designed for calm
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              Every feature exists because an NGO finance manager asked for it. Nothing extra, nothing missing.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <Card key={i} className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
                <CardContent className="p-8">
                  <div className="flex items-start gap-5">
                    <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                      <feature.icon className="h-6 w-6 text-slate-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg text-slate-900">{feature.title}</h3>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                      <p className="text-sm text-slate-500 mb-2">{feature.description}</p>
                      <p className="text-xs font-medium text-slate-400 italic">"{feature.painPoint}"</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="py-24 lg:py-32 bg-white">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4 px-3 py-1 rounded-full text-slate-500 border-slate-200 text-xs">
              Real voices
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
              Trusted by finance teams across Zambia
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((t, i) => (
              <div key={i} className="relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <Quote className="h-8 w-8 text-slate-200 absolute top-6 right-6" />
                <p className="text-base text-slate-600 leading-relaxed mb-8 italic">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.role}</p>
                    <p className="text-xs text-slate-400">{t.org}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPLIANCE ===== */}
      <section id="compliance" className="py-24 lg:py-32 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3" />

        <div className="container mx-auto px-4 lg:px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4 px-3 py-1 rounded-full border-slate-700 text-slate-300 text-xs">
              Regulatory compliance
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight">
              Fully Zambian-compliant. Automatically.
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Built from the ground up for ZRA, NAPSA, NHIMA, and PACRA requirements. 
              When regulations change, ZedBooks updates — you don't lift a finger.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div className="flex flex-wrap gap-3">
              {[
                { name: "ZRA Smart Invoice", icon: Globe },
                { name: "NAPSA e-Returns", icon: Globe },
                { name: "NHIMA Compliant", icon: Shield },
                { name: "PACRA Returns", icon: Building2 },
              ].map((badge) => (
                <div key={badge.name} className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-sm font-medium text-slate-200">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  {badge.name}
                </div>
              ))}
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/60 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-700/60">
                <div className="h-12 w-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <Shield className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Compliance Monitor</h3>
                  <p className="text-xs text-slate-400">Real-time status tracking</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ['TPIN Verification', 'Verified', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'],
                  ['Tax Clearance', 'Valid', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'],
                  ['Annual Returns', 'Due in 5 days', 'bg-amber-500/10 text-amber-400 border-amber-500/20'],
                ].map(([item, status, klass]) => (
                  <div key={item} className="flex items-center justify-between rounded-xl bg-slate-800/40 px-4 py-3 border border-slate-700/40">
                    <span className="text-sm font-medium text-slate-200">{item}</span>
                    <Badge className={`${klass} text-[10px] font-bold border`}>{status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link to="/auth">
              <Button className="rounded-lg bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 shadow-lg font-semibold transition-all hover:shadow-xl hover:-translate-y-0.5">
                Get Compliant Today
              </Button>
            </Link>
            <a href={demoHref} target="_blank" rel="noreferrer">
              <Button variant="outline" className="rounded-lg border-slate-600 bg-transparent text-white hover:bg-white hover:text-slate-900 px-8 h-12 transition-all">
                Book Compliance Demo
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="container mx-auto px-4 lg:px-6 text-center max-w-3xl">
          <Badge variant="outline" className="mb-4 px-3 py-1 rounded-full text-slate-500 border-slate-200 text-xs">
            Ready to simplify?
          </Badge>
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            Your next month-end could be the calmest one yet
          </h2>
          <p className="text-lg text-slate-500 mb-10 leading-relaxed">
            We'll walk your team through the first payroll run, compliance setup, and grant tracking. 
            No fluff, no upsell — just a product that works for Zambian NGOs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={demoHref} target="_blank" rel="noreferrer">
              <Button size="lg" className="h-14 px-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20 text-base font-semibold transition-all hover:shadow-2xl hover:-translate-y-0.5">
                Book ZedBooks Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            {deferredPrompt && (
              <Button onClick={handleInstallClick} variant="outline" className="h-14 px-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all">
                <Download className="mr-2 h-5 w-5" />
                Install Web App
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 bg-slate-50 border-t border-slate-100">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo variant="full" size="sm" />
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Lusaka, Zambia
              </span>
              <a href="https://byteandberry.com" className="hover:text-slate-600 transition-colors" target="_blank" rel="noreferrer">
                Byte & Berry
              </a>
              <span>© {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </footer>
      <ByteBerryWatermark />
    </div>
  );
}
