import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { calculatePAYE, calculateNAPSA, calculateNHIMA, formatZMW } from "@/utils/zambianTaxCalculations";
import { ArrowLeft, Calculator } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TaxCalculator() {
  const navigate = useNavigate();
  const [basicSalary, setBasicSalary] = useState<string>("");
  const [grossSalary, setGrossSalary] = useState<string>("");
  const [results, setResults] = useState<{
    paye: number;
    napsaEmployee: number;
    napsaEmployer: number;
    nhimaEmployee: number;
    nhimaEmployer: number;
    totalDeductions: number;
    netSalary: number;
    employerCost: number;
  } | null>(null);

  const calculateTax = () => {
    const basic = Number(basicSalary) || 0;
    const gross = Number(grossSalary) || 0;

    if (gross <= 0) {
      return;
    }

    const paye = calculatePAYE(gross);
    const napsa = calculateNAPSA(basic, gross);
    const nhima = calculateNHIMA(basic);

    const totalDeductions = paye + napsa.employee + nhima.employee;
    const netSalary = gross - totalDeductions;
    const employerCost = gross + napsa.employer + nhima.employer;

    setResults({
      paye,
      napsaEmployee: napsa.employee,
      napsaEmployer: napsa.employer,
      nhimaEmployee: nhima.employee,
      nhimaEmployer: nhima.employer,
      totalDeductions,
      netSalary,
      employerCost,
    });
  };

  const examples = [
    { gross: 5000, description: "Below first threshold" },
    { gross: 6000, description: "In second band" },
    { gross: 8000, description: "In third band" },
    { gross: 12000, description: "In fourth band" },
    { gross: 45000, description: "High income example" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Tax Calculator</h1>
          <p className="text-muted-foreground">Calculate PAYE, NAPSA, NHIMA, and net salary</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculate Taxes
            </CardTitle>
            <CardDescription>
              Enter salary details to see tax breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="basicSalary">Basic Salary (ZMW)</Label>
              <Input
                id="basicSalary"
                type="number"
                step="0.01"
                placeholder="Enter basic salary"
                value={basicSalary}
                onChange={(e) => setBasicSalary(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grossSalary">Gross Salary (ZMW)</Label>
              <Input
                id="grossSalary"
                type="number"
                step="0.01"
                placeholder="Enter gross salary"
                value={grossSalary}
                onChange={(e) => setGrossSalary(e.target.value)}
              />
            </div>
            <Button onClick={calculateTax} className="w-full">
              Calculate
            </Button>

            {results && (
              <div className="mt-6 space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Results</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PAYE Tax:</span>
                    <span className="font-medium">{formatZMW(results.paye)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NAPSA (Employee):</span>
                    <span className="font-medium">{formatZMW(results.napsaEmployee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NHIMA (Employee):</span>
                    <span className="font-medium">{formatZMW(results.nhimaEmployee)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span>Total Deductions:</span>
                    <span>{formatZMW(results.totalDeductions)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Net Salary:</span>
                    <span className="text-primary">{formatZMW(results.netSalary)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t space-y-2">
                  <h4 className="font-semibold text-sm">Employer Contributions</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NAPSA (Employer):</span>
                    <span className="font-medium">{formatZMW(results.napsaEmployer)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NHIMA (Employer):</span>
                    <span className="font-medium">{formatZMW(results.nhimaEmployer)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span>Total Employer Cost:</span>
                    <span>{formatZMW(results.employerCost)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax Band Reference</CardTitle>
            <CardDescription>Zambian PAYE tax bands (2025/26)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">K0 - K5,100</span>
                  <span className="text-sm font-bold">0%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">First K5,100 is tax-free</p>
              </div>
              
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">K5,100.01 - K7,100</span>
                  <span className="text-sm font-bold">20%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Next K2,000 taxed at 20%</p>
              </div>
              
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">K7,100.01 - K9,200</span>
                  <span className="text-sm font-bold">30%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Next K2,100 taxed at 30%</p>
              </div>
              
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Above K9,200</span>
                  <span className="text-sm font-bold">37%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Balance taxed at 37%</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3">Quick Examples</h4>
              <div className="space-y-2">
                {examples.map((example) => (
                  <Button
                    key={example.gross}
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => {
                      setBasicSalary(example.gross.toString());
                      setGrossSalary(example.gross.toString());
                    }}
                  >
                    <span className="text-xs">{example.description}</span>
                    <span className="font-semibold">{formatZMW(example.gross)}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-lg text-xs space-y-1">
              <p><strong>NAPSA:</strong> Employee 5% of basic, Employer 5% of gross (max K1,221.80)</p>
              <p><strong>NHIMA:</strong> 1% of basic salary each (employee & employer)</p>
              <p><strong>PAYE:</strong> Progressive tax on gross salary</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
