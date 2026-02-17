import { useState, useRef, useEffect } from "react";
import { useAI } from "@/hooks/useAI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, X, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";

export function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const { messages, isLoading, askAI, clearChat } = useAI();
    const scrollRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();
    const [companyId, setCompanyId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    useEffect(() => {
        async function loadCompany() {
            if (user) {
                const membership = await companyService.getPrimaryMembershipByUser(user.id);
                if (membership) setCompanyId(membership.companyId);
            }
        }
        loadCompany();
    }, [user]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        askAI(input, companyId);
        setInput("");
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-20 right-6 z-50 w-[90vw] md:w-[400px] shadow-2xl"
                    >
                        <Card className="border-primary/20 bg-background/95 backdrop-blur-sm h-[500px] flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-primary/10 rounded-lg">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-medium">ZedBooks AI</CardTitle>
                                        <p className="text-xs text-muted-foreground">Financial Assistant</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="Clear Chat">
                                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-hidden relative">
                                <div
                                    ref={scrollRef}
                                    className="h-full overflow-y-auto p-4 space-y-4 scroll-smooth"
                                >
                                    {messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex w-full",
                                                msg.role === "user" ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                                                    msg.role === "user"
                                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                                        : "bg-muted text-foreground rounded-bl-none"
                                                )}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="p-3 border-t bg-muted/20">
                                <form onSubmit={handleSubmit} className="flex gap-2 w-full">
                                    <Input
                                        placeholder="Ask about your finances..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        className="bg-background focus-visible:ring-offset-0"
                                    />
                                    <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50"
            >
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    size="icon"
                    className={cn(
                        "h-12 w-12 rounded-full shadow-lg transition-all duration-300",
                        isOpen ? "bg-muted text-muted-foreground rotate-90" : "bg-primary text-primary-foreground"
                    )}
                >
                    {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
                </Button>
            </motion.div>
        </>
    );
}
