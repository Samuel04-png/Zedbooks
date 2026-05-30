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
  Play,
  Download
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

const features = [
  {
    icon: Users,
    title: "Employee Management",
    description: "Complete database with role-based access control and history tracking.",
    className: "border-l-4 border-blue-500",
  },
  {
    icon: Briefcase,
    title: "Payroll Processing",
    description: "Automated calculations for PAYE, NAPSA, and NHIMA with one-click rendering.",
    className: "border-l-4 border-indigo-500",
  },
  {
    icon: Shield,
    title: "Compliance & Audit",
    description: "Built-in ZRA compliance rules and detailed audit logs for every action.",
    className: "border-l-4 border-slate-500",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Live financial dashboards and customizable reports for better decision making.",
    className: "border-l-4 border-sky-500",
  },
];

const demoHref =
  "https://wa.me/260760580949?text=Hi%20Byte%20%26%20Berry%2C%20I%20want%20to%20book%20a%20ZedBooks%20demo%20for%20our%20NGO%20finance%20team.";

const trustPoints = [
  "Payroll, statutory deductions, and audit trails in one workspace",
  "Built around ZRA, NAPSA, NHIMA, PACRA, and NGO reporting needs",
  "Designed for finance managers who need clean monthly records",
];

export default function Landing() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      // Let the browser show its own prompt if it wants, 
      // but still capture the event for our custom button.
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
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="container mx-auto px-4 lg:px-6 flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3">
            <Logo variant="full" size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-700 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-700 transition-colors">Pricing</a>
            <a href="#compliance" className="hover:text-blue-700 transition-colors">Compliance</a>
            <a href={demoHref} className="hover:text-blue-700 transition-colors">Book Demo</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:inline-flex text-slate-600 hover:text-blue-700 hover:bg-blue-50">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-6 transition-all hover:scale-105">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-48 overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-100/40 rounded-[100%] blur-[100px] -z-10 pointer-events-none opacity-60" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-[80px] -z-10 pointer-events-none opacity-50" />

        <div className="container mx-auto px-4 lg:px-6 relative z-10 text-center">
          <Badge variant="outline" className="mb-8 px-4 py-1.5 rounded-full bg-blue-50/50 text-blue-700 border-blue-200 backdrop-blur-sm animate-fade-in-up">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            New: Automated ZRA Tax Submission
          </Badge>

          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-[1.1]">
            The Financial Operating System for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600">Zambian NGOs</span>
          </h1>

          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Manage NGO finances, payroll, grants, supplier payments, and Zambia-specific compliance in one secure workspace built for clean month-end reporting.
          </p>

          <div className="mb-12 grid gap-3 max-w-3xl mx-auto text-left sm:grid-cols-3">
            {trustPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-blue-100 bg-white/70 px-4 py-3 text-sm font-medium leading-6 text-slate-700 shadow-sm backdrop-blur">
                <Check className="mb-2 h-4 w-4 text-blue-600" />
                {point}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <a href={demoHref} target="_blank" rel="noreferrer">
              <Button size="lg" className="h-14 px-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 text-lg transition-all hover:scale-105">
                Book a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-14 px-10 rounded-full border-slate-200 hover:bg-white hover:text-blue-700 hover:border-blue-200 text-lg shadow-sm transition-all">
                Start Free Trial
              </Button>
            </Link>
            <a href="#compliance">
              <Button size="lg" variant="ghost" className="h-14 px-6 rounded-full text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-lg transition-all">
                <Play className="mr-2 h-5 w-5" />
                See Compliance Flow
              </Button>
            </a>
          </div>

          {/* Floated UI Mockup */}
          <div className="relative max-w-5xl mx-auto">
            {/* Main Window */}
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden backdrop-blur-sm">
              <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <div className="mx-auto bg-slate-200/50 h-6 w-64 rounded-md text-[10px] flex items-center justify-center text-slate-400 font-mono">
                  app.zedbooks.com/dashboard
                </div>
              </div>
              <div className="p-1 bg-slate-50/50">
                <div className="grid grid-cols-12 gap-1 p-4 h-[400px] lg:h-[600px] bg-white rounded-xl overflow-hidden relative">
                  {/* Realistic dashboard preview */}
                  <div className="col-span-2 hidden lg:flex flex-col gap-3 border-r border-slate-50 pr-4">
                    {['Dashboard', 'Payroll', 'Grants', 'Compliance', 'Reports'].map((item, index) => (
                      <div key={item} className={`rounded-lg px-3 py-2 text-left text-xs font-semibold ${index === 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="col-span-12 lg:col-span-10 flex flex-col gap-6 pl-0 lg:pl-6 pt-2">
                    <div className="flex justify-between items-end">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">April finance close</p>
                        <h3 className="text-left text-2xl font-bold text-slate-900">NGO Finance Dashboard</h3>
                      </div>
                      <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">Compliant</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-32 bg-blue-50 rounded-2xl border border-blue-100 p-4 space-y-2 text-left">
                        <p className="text-xs font-semibold text-blue-700">Grant balance</p>
                        <p className="text-2xl font-bold text-slate-900">K842k</p>
                        <p className="text-xs text-slate-500">6 active grants</p>
                      </div>
                      <div className="h-32 bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2 text-left">
                        <p className="text-xs font-semibold text-slate-500">Payroll due</p>
                        <p className="text-2xl font-bold text-slate-900">K156k</p>
                        <p className="text-xs text-slate-500">PAYE/NAPSA ready</p>
                      </div>
                      <div className="h-32 bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2 text-left">
                        <p className="text-xs font-semibold text-slate-500">Pending approvals</p>
                        <p className="text-2xl font-bold text-slate-900">12</p>
                        <p className="text-xs text-slate-500">Bills & expenses</p>
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-800">Compliance timeline</p>
                        <p className="text-xs font-medium text-slate-400">Next 30 days</p>
                      </div>
                      <div className="space-y-3 text-left">
                        {[
                          ['ZRA Smart Invoice sync', 'Ready to submit', 'bg-green-50 text-green-700'],
                          ['NAPSA monthly return', 'Draft generated', 'bg-blue-50 text-blue-700'],
                          ['Board donor report', 'Needs approval', 'bg-amber-50 text-amber-700'],
                        ].map(([title, status, klass]) => (
                          <div key={title} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                            <span className="text-sm font-medium text-slate-700">{title}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${klass}`}>{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Card 1 */}
            <div className="absolute -left-12 bottom-20 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 hidden lg:block animate-float">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Compliance Status</p>
                  <p className="text-xs text-slate-500">Last checked today</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-green-50 text-green-700">NAPSA Verified</Badge>
                <Badge variant="secondary" className="bg-green-50 text-green-700">ZRA Compliant</Badge>
              </div>
            </div>

            {/* Floating Card 2 */}
            <div className="absolute -right-8 top-20 bg-white p-5 rounded-2xl shadow-xl border border-slate-100 hidden lg:block animate-float-delayed">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-3">Recent Transactions</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">JD</div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Payroll Run</p>
                    <p className="text-xs text-slate-400">Just now</p>
                  </div>
                  <span className="text-sm font-medium text-slate-900 ml-4">- K45,200</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">IN</div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Grant Deposit</p>
                    <p className="text-xs text-slate-400">2h ago</p>
                  </div>
                  <span className="text-sm font-medium text-green-600 ml-4">+ K150,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white relative">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to run your NGO</h2>
            <p className="text-slate-600">Robust features designed specifically for the unique compliance and reporting needs of Zambian non-profits.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <Card key={i} className={`shadow-sm hover:shadow-lg transition-all border-slate-200 bg-white ${feature.className}`}>
                <CardContent className="p-8">
                  <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center mb-6">
                    <feature.icon className="h-6 w-6 text-slate-700" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* App Download / Compliance */}
      <section id="compliance" className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2" />

        <div className="container mx-auto px-4 lg:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">Fully Compliant with Zambian Regulation</h2>
              <p className="text-slate-300 text-lg mb-8">
                Stay ahead of regulatory requirements with automated updates for domestic tax laws and labor regulations.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                {['ZRA Smart Invoice', 'NAPSA e-Returns', 'NHIMA Compliant', 'PACRA Returns'].map((badge) => (
                  <div key={badge} className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm font-medium text-slate-200">
                    <Check className="h-4 w-4 text-green-400" />
                    {badge}
                  </div>
                ))}
              </div>
              <Link to="/auth">
                <Button className="rounded-full bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 shadow-md">
                  Get Compliant Today
                </Button>
              </Link>
              <a href={demoHref} target="_blank" rel="noreferrer" className="ml-3 inline-flex">
                <Button variant="outline" className="rounded-full border-slate-600 bg-transparent text-white hover:bg-white hover:text-slate-900 px-8 h-12 shadow-md">
                  Book Compliance Demo
                </Button>
              </a>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-slate-700 shadow-2xl">
                <div className="flex items-center gap-4 mb-8 border-b border-slate-700 pb-8">
                  <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Compliance Monitor</h3>
                    <p className="text-slate-400 text-sm">Real-time status tracking</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <span className="text-slate-200 font-medium">TPIN Verification</span>
                    <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/20 border-green-500/20">Verified</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <span className="text-slate-200 font-medium">Tax Clearance</span>
                    <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/20 border-green-500/20">Valid</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <span className="text-slate-200 font-medium">Annual Returns</span>
                    <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/20">Due in 5 days</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100 mb-4">Demo-ready for finance teams</p>
          <h2 className="text-4xl font-bold mb-5">See how ZedBooks can clean up your NGO finance workflow.</h2>
          <p className="text-blue-50 text-lg mb-8">We will walk through payroll, compliance, approvals, grants, and reporting using a Zambia-specific workflow.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={demoHref} target="_blank" rel="noreferrer">
              <Button className="rounded-full bg-white text-blue-700 hover:bg-blue-50 px-8 h-12 shadow-md">Book ZedBooks Demo</Button>
            </a>
            {deferredPrompt && (
              <Button onClick={handleInstallClick} variant="outline" className="rounded-full border-blue-200 bg-transparent text-white hover:bg-white hover:text-blue-700 px-8 h-12">
                <Download className="mr-2 h-5 w-5" />
                Install Web App
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer className="py-12 bg-white border-t border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Logo variant="full" size="md" className="grayscale opacity-70 hover:grayscale-0 hover:opacity-100" />
          </div>
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Byte & Berry. All rights reserved.</p>
        </div>
      </footer>
      <ByteBerryWatermark />
    </div>
  );
}
