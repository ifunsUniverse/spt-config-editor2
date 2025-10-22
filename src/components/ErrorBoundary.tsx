import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleCopyDetails = () => {
    const { error, errorInfo } = this.state;
    const details = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;
    navigator.clipboard.writeText(details);
    toast.success('Error details copied to clipboard');
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                The application encountered an unexpected error
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-md overflow-auto max-h-60">
                <p className="text-sm font-mono text-destructive font-semibold mb-2">
                  {this.state.error?.message}
                </p>
                {this.state.error?.stack && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                )}
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      Component Stack
                    </summary>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={this.handleReload} variant="default">
                  Reload Application
                </Button>
                <Button onClick={this.handleCopyDetails} variant="outline">
                  Copy Error Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
