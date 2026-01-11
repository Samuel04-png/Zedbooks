import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Shield, 
  Users, 
  FileText, 
  DollarSign, 
  Clock, 
  Check,
  ArrowRight,
  Building2,
  PieChart,
  Calculator,
  Briefcase
} from "lucide-react";

const features = [
  {
    icon: DollarSign,
    title: "Payroll Management",
    description: "Automated ZRA-compliant payroll calculations with NAPSA, NHIMA, and PAYE deductions."
  },
  {
    icon: FileText,
    title: "Invoicing & Billing",
    description: "Professional invoices, estimates, and sales orders with VAT support."
  },
  {
    icon: BarChart3,
    title: "Financial Reports",
    description: "Income statements, balance sheets, cash flow, and trial balance reports."
  },
  {
    icon: Users,
    title: "HR & Employee Management",
    description: "Complete employee records, contracts, advances, and time tracking."
  },
  {
    icon: Briefcase,
    title: "Project & Grant Tracking",
    description: "Track donor-funded projects, budgets, and expenses for NGOs."
  },
  {
    icon: Shield,
    title: "ZRA Compliance",
    description: "Stay compliant with Zambian tax regulations and generate statutory reports."
  }
];

const pricingPlans = [
  {
    name: "Starter",
    price: "K299",
    period: "/month",
    description: "Perfect for small businesses and startups",
    features: [
      "Up to 5 employees",
      "Basic payroll processing",
      "Invoicing & estimates",
      "Expense tracking",
      "Email support",
      "1 user account"
    ],
    popular: false
  },
  {
    name: "Business",
    price: "K799",
    period: "/month",
    description: "For growing businesses with more needs",
    features: [
      "Up to 25 employees",
      "Full payroll with ZRA compliance",
      "Inventory management",
      "Bank reconciliation",
      "Project & grant tracking",
      "Financial reports",
      "5 user accounts",
      "Priority support"
    ],
    popular: true
  },
  {
    name: "Enterprise",
    price: "K1,999",
    period: "/month",
    description: "Complete solution for large organizations",
    features: [
      "Unlimited employees",
      "All Business features",
      "Multi-company support",
      "Custom integrations",
      "Audit trail & compliance",
      "Unlimited users",
      "Dedicated account manager",
      "24/7 phone support"
    ],
    popular: false
  }
];

const steps = [
  {
    number: "01",
    title: "Sign Up",
    description: "Create your account in minutes with just an email and password."
  },
  {
    number: "02",
    title: "Set Up Your Company",
    description: "Add your company details, logo, and configure tax settings."
  },
  {
    number: "03",
    title: "Add Your Data",
    description: "Import employees, customers, and vendors or add them manually."
  },
  {
    number: "04",
    title: "Start Managing",
    description: "Process payroll, create invoices, track expenses, and generate reports."
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">FinanceFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="container relative mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6">
            Trusted by 500+ Zambian businesses
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            Complete Financial Management
            <br />
            <span className="text-primary">for Zambian Businesses</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Payroll, invoicing, accounting, and compliance – all in one powerful platform. 
            Designed specifically for Zambian tax regulations and business practices.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Run Your Business</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From payroll to financial reporting, we've got you covered with tools designed for Zambian businesses.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Get Started in 4 Simple Steps</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Setting up your account is quick and easy. You'll be up and running in no time.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {step.number}
                </div>
                <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-muted/30" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include a 14-day free trial.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block">
                    <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                      Start Free Trial
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Business?</h2>
              <p className="mb-8 text-primary-foreground/80 max-w-2xl mx-auto">
                Join hundreds of Zambian businesses already using FinanceFlow to streamline their operations.
              </p>
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="gap-2">
                  Get Started Now <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-semibold">FinanceFlow</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground">Privacy Policy</a>
              <a href="#" className="hover:text-foreground">Terms of Service</a>
              <a href="#" className="hover:text-foreground">Contact</a>
            </div>
            <a 
              href="https://www.byteandberry.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              Powered by byte&berry
            </a>
          </div>
          <div className="mt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} FinanceFlow. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}