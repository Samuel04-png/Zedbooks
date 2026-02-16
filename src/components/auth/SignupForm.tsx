import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Loader2, Building2, Mail, Lock, Phone, Hash, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { authService } from "@/services/firebase";
import { toast } from "sonner";
import { AuthLayout } from "./AuthLayout";

// --- Visual Content for "Growth" Theme ---
const SignupVisuals = () => (
    <div className="relative w-full h-full flex flex-col items-center justify-center space-y-8">
        {/* Floating Success Card */}
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="absolute top-20 right-10 bg-white p-4 rounded-xl shadow-2xl flex items-center gap-4 z-20"
        >
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                +
            </div>
            <div>
                <p className="text-sm font-medium text-slate-800">New Customer</p>
                <p className="text-xs text-slate-500">Just joined your network</p>
            </div>
        </motion.div>

        {/* Animated Growth Chart */}
        <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl relative">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-semibold">Monthly Growth</h3>
                    <p className="text-slate-400 text-sm">Revenue vs Expenses</p>
                </div>
                <div className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> 24%
                </div>
            </div>

            <div className="h-32 flex items-end justify-between gap-2">
                {[30, 45, 35, 60, 50, 75, 65, 90].map((h, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                        className="w-full bg-gradient-to-t from-blue-600 to-indigo-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                    />
                ))}
            </div>
        </div>
    </div>
);

// --- Form Logic ---
const signupSchema = z.object({
    organizationName: z.string().min(1, "Organization name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\+?[0-9]+$/, "Invalid phone number"),
    organizationType: z.enum(["business", "non_profit"]),
    taxClassification: z.string().min(1, "Tax classification is required"),
    tpin: z.string().regex(/^\d{10}$/, "TPIN must be exactly 10 digits"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

interface SignupFormProps {
    onLogin: () => void;
    onSignupSuccess: (email: string) => void;
}

export function SignupForm({ onLogin, onSignupSuccess }: SignupFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            organizationType: "business",
            taxClassification: "",
        },
    });

    const organizationType = watch("organizationType");

    const onSubmit = async (data: SignupFormValues) => {
        setIsLoading(true);
        try {
            await authService.signUp({
                email: data.email,
                password: data.password,
                organizationName: data.organizationName,
                phone: data.phone,
                organizationType: data.organizationType,
                taxClassification: data.taxClassification,
                tpin: data.tpin,
            });

            toast.success("Account created successfully!");
            onSignupSuccess(data.email);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create account";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Create Account"
            subtitle="Start your journey with ZedBooks today"
            visualContent={<SignupVisuals />}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="orgName"
                            placeholder="e.g. Acme Corp"
                            className="pl-10"
                            {...register("organizationName")}
                        />
                    </div>
                    {errors.organizationName && <p className="text-sm text-destructive">{errors.organizationName.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Organization Type</Label>
                        <Select
                            onValueChange={(val) => {
                                setValue("organizationType", val as "business" | "non_profit");
                                setValue("taxClassification", ""); // Reset tax class on type change
                            }}
                            defaultValue="business"
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="business">Business</SelectItem>
                                <SelectItem value="non_profit">Non-profit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Tax Classification</Label>
                        <Select onValueChange={(val) => setValue("taxClassification", val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                                {organizationType === "business" ? (
                                    <>
                                        <SelectItem value="vat_registered">VAT Registered</SelectItem>
                                        <SelectItem value="turnover_tax">Turnover Tax</SelectItem>
                                        <SelectItem value="non_vat">Non-VAT</SelectItem>
                                    </>
                                ) : (
                                    <>
                                        <SelectItem value="tax_exempt">Tax Exempt</SelectItem>
                                        <SelectItem value="grant_funded">Grant Funded</SelectItem>
                                        <SelectItem value="charitable">Charitable</SelectItem>
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                        {errors.taxClassification && <p className="text-sm text-destructive">{errors.taxClassification.message}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>TPIN (10 digits)</Label>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="1234567890"
                            className="pl-10"
                            {...register("tpin")}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                setValue("tpin", val);
                            }}
                        />
                    </div>
                    {errors.tpin && <p className="text-sm text-destructive">{errors.tpin.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            className="pl-10"
                            {...register("email")}
                        />
                    </div>
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="phone"
                            placeholder="+260..."
                            className="pl-10"
                            {...register("phone")}
                        />
                    </div>
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            {...register("password")}
                        />
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Account...
                        </>
                    ) : (
                        "Create Account"
                    )}
                </Button>

                <div className="text-center text-sm text-muted-foreground mt-4">
                    Already have an account?{" "}
                    <button
                        type="button"
                        onClick={onLogin}
                        className="text-primary hover:underline font-medium"
                    >
                        Sign in
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
}
