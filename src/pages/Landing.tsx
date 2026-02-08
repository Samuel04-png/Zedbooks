import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  DollarSign,
  Check,
  ArrowRight,
  Building2,
  Calculator,
  Shield,
  Briefcase,
  BarChart3,
  ChevronRight,
  Play,
  Star,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Employee Benefits",
    description: "Comprehensive employee management with benefits tracking and compliance.",
    color: "bg-orange-100 text-orange-600",
  },
  {
    icon: Briefcase,
    title: "HR Admin and Payroll",
    description: "Streamlined HR operations with integrated payroll processing.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: Shield,
    title: "Risk Management",
    description: "Built-in compliance and audit trails for peace of mind.",
    color: "bg-green-100 text-green-600",
  },
  {
    icon: BarChart3,
    title: "HR Support and Technology",
    description: "Advanced reporting and analytics for data-driven decisions.",
    color: "bg-purple-100 text-purple-600",
  },
];

const pricingPlans = [
  {
    name: "Basic Plan",
    description: "Suitable for starter business",
    price: "K299",
    period: "/month",
    features: [
      "Up to 5 employees",
      "Basic payroll processing",
      "Invoicing & estimates",
      "Email support",
    ],
    popular: false,
    buttonText: "Choose Plan",
    buttonStyle: "outline" as const,
  },
  {
    name: "Enterprise Plan",
    description: "Best plan for mid-sized businesses",
    price: "K799",
    period: "/month",
    features: [
      "Got a Basic Plans",
      "Access All Features",
      "Get 1 TB Cloud Storage",
      "Priority support",
    ],
    popular: true,
    buttonText: "Choose Plan",
    buttonStyle: "default" as const,
  },
];

const stats = [
  { value: "500+", label: "Active Businesses" },
  { value: "50K+", label: "Employees Managed" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-100">
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">ZedBooks</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-gray-600 hover:text-orange-500 font-medium transition-colors">
              HR Solutions
            </Link>
            <Link to="/" className="text-gray-600 hover:text-orange-500 font-medium transition-colors">
              About Us
            </Link>
            <Link to="/" className="text-gray-600 hover:text-orange-500 font-medium transition-colors">
              Resources
            </Link>
            <Link to="/" className="text-gray-600 hover:text-orange-500 font-medium transition-colors">
              Who We Serve
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <a href="mailto:hello@byteandberry.com">
              <Button variant="ghost" className="text-gray-600 hover:text-orange-500">
                Contact Sales
              </Button>
            </a>
            <Link to="/auth">
              <Button variant="ghost" className="text-gray-600 hover:text-orange-500">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="rounded-full bg-orange-500 hover:bg-orange-600">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-0 w-96 h-96 bg-orange-100 rounded-full opacity-50 -translate-x-1/2" />
          <div className="absolute top-40 left-20 w-32 h-32 bg-orange-200 rounded-full opacity-40" />
        </div>

        <div className="container mx-auto px-4 py-20 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  <span className="text-orange-500">HR Solutions</span>
                  <br />
                  That Scale With
                  <br />
                  Your Business
                </h1>
                <p className="mt-6 text-lg text-gray-600 max-w-xl">
                  Streamlining your business operations is crucial for efficiency, and one way to achieve this is by managing your HR and payroll in a single system.
                </p>
              </div>

              <Link to="/auth">
                <Button size="lg" className="rounded-full bg-orange-500 hover:bg-orange-600 px-8">
                  Contact Sales
                </Button>
              </Link>
            </div>

            <div className="relative">
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange-100 rounded-full opacity-50" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-100 rounded-full opacity-50" />
              <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white">
                <div className="absolute -top-4 -right-4 bg-orange-400 rounded-full p-3">
                  <Play className="h-6 w-6" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">500+ Businesses</p>
                      <p className="text-sm text-blue-200">Trust ZedBooks</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20">
                    <p className="text-sm text-blue-200">Complete HR & Payroll Solution</p>
                    <p className="font-semibold text-lg">ZRA Compliant</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our Full-Service HR <span className="text-orange-500">Solution</span>
              <br />
              Delivers
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow group cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${feature.color} mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
            <Card className="border-0 shadow-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
                  <ArrowRight className="h-8 w-8" />
                </div>
                <p className="font-semibold">Browse All</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="bg-gray-100 rounded-3xl p-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-6 shadow-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                    </div>
                    <p className="text-sm text-gray-600">Overall satisfaction rating</p>
                  </div>
                  <div className="bg-teal-600 rounded-2xl p-6 text-white">
                    <p className="text-3xl font-bold">90+</p>
                    <p className="text-sm">Locations nationwide</p>
                  </div>
                </div>
                <div className="mt-4 bg-amber-100 rounded-2xl p-4 text-center">
                  <Badge className="bg-amber-200 text-amber-800 font-semibold">
                    ZRA Accredited
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">
                Support Your Business With
                <br />
                <span className="text-orange-500">Award-Winning Expertise</span>
              </h2>
              <p className="text-gray-600">
                Your employees are your most valuable resource. When you have better HR support, you will have a designed our HR support services to lighten your administrative load and maximize your productivity while managing risks.
              </p>
              <Link to="/auth">
                <Button className="rounded-full bg-orange-500 hover:bg-orange-600 px-8">
                  Learn More About ZedBooks
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Unbeatable Support Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-orange-200 rounded-full opacity-50" />
                <div className="relative bg-white rounded-3xl p-6 shadow-xl">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex -space-x-2">
                      <div className="w-10 h-10 rounded-full bg-orange-400" />
                      <div className="w-10 h-10 rounded-full bg-blue-400" />
                      <div className="w-10 h-10 rounded-full bg-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Team Collaboration</p>
                      <p className="text-sm text-gray-500">Work together seamlessly</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-orange-50 rounded-xl p-4 text-center">
                      <DollarSign className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-600">Payroll</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <Calculator className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-600">Accounting</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <FileText className="h-6 w-6 text-green-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-600">Reports</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">
                Unbeatable Support
                <br />
                Meets <span className="text-orange-500">Innovative</span>
                <br />
                Technology
              </h2>
              <p className="text-gray-600">
                Unmatched Support: At ZedBooks, we believe that exceptional customer support is the cornerstone of a successful business. Our dedicated team of professionals...
              </p>
              <div className="flex gap-4">
                <Link to="/auth">
                  <Button className="rounded-full bg-orange-500 hover:bg-orange-600">
                    Small Businesses
                  </Button>
                </Link>
                <Button variant="outline" className="rounded-full border-orange-500 text-orange-500 hover:bg-orange-50">
                  Midsize Businesses
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent <span className="text-orange-500">Pricing</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`relative border-2 ${plan.popular ? 'border-orange-500 shadow-xl' : 'border-gray-100'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-orange-500 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-500">{plan.description}</p>
                    </div>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${plan.popular ? 'bg-orange-100' : 'bg-gray-100'}`}>
                          <Check className={`h-3 w-3 ${plan.popular ? 'text-orange-500' : 'text-gray-500'}`} />
                        </div>
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth" className="block">
                    <Button
                      className={`w-full rounded-full ${plan.popular ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                      variant={plan.buttonStyle}
                    >
                      {plan.buttonText}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              ZedBooks Customers Are
              <br />
              Finding <span className="text-orange-500">Success</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Human resources and business performance solutions, has a track record of helping us in various ways. One of the key factors contributing to this success is ZedBooks commitment to providing tailored HR solutions and support.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl font-bold text-orange-500 mb-2">{stat.value}</p>
                <p className="text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 border-0">
            <CardContent className="p-12 text-center text-white">
              <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Business?</h2>
              <p className="mb-8 text-white/80 max-w-2xl mx-auto">
                Join hundreds of Zambian businesses already using ZedBooks to streamline their operations.
              </p>
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="rounded-full gap-2">
                  Get Started Now <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">ZedBooks</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-orange-500 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-orange-500 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-orange-500 transition-colors">Contact</a>
            </div>
            <a
              href="https://www.byteandberry.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-100 transition-colors"
            >
              Powered by byte&berry
            </a>
          </div>
          <div className="mt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} ZedBooks. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
