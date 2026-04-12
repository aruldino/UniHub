import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global Error Boundary Caught:', error, errorInfo);
    this.setState({ errorInfo });

    // Log to your error tracking service here
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] p-4">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#2baec1]/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#2e406a]/10 rounded-full blur-3xl"></div>
          </div>

          <Card className="relative z-10 max-w-2xl w-full border-0 shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary to-primary"></div>

            <CardHeader className="text-center pb-6">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-[#2baec1] to-[#2baec1]/60 shadow-lg shadow-[#2baec1]/30 mb-4">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                System Error Detected
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-slate-900 mb-1">
                      {this.state.error?.name || 'Unknown Error'}
                    </p>
                    <p className="text-sm text-slate-600 font-mono break-all">
                      {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                  </div>
                </div>
              </div>

              {this.state.errorInfo && (
                <div className="p-4 rounded-xl bg-[#2baec1]/10 border border-[#2baec1]/20">
                  <p className="text-xs font-semibold text-[#2baec1] mb-2">Error Details:</p>
                  <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={this.handleReset}
                  className="flex-1 h-12 rounded-xl font-bold relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                  style={{
                    background: 'linear-gradient(135deg, #2baec1 0%, #2baec1 50%, #2e406a 50%, #2e406a 100%)',
                    backgroundSize: '200% 100%',
                    boxShadow: '0 4px 20px rgba(43, 174, 193, 0.4)'
                  }}
                >
                  <RefreshCcw className="mr-2 h-5 w-5" />
                  Reload Application
                </Button>
              </div>

              <p className="text-xs text-slate-500 text-center">
                If this problem persists, please contact your system administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
