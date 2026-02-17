
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
                    <div className="max-w-md w-full text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="p-3 bg-red-100 rounded-full">
                                <AlertTriangle className="h-8 w-8 text-red-600" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Something went wrong</h1>
                        <p className="text-muted-foreground">
                            We encountered an unexpected error. Please try refreshing the page.
                        </p>
                        {this.state.error && (
                            <pre className="p-4 bg-muted rounded-lg text-xs text-left overflow-auto max-h-40">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-2 justify-center">
                            <Button onClick={() => window.location.reload()}>
                                Refresh Page
                            </Button>
                            <Button variant="outline" onClick={() => (window.location.href = "/")}>
                                Go Home
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
