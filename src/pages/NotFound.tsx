import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#2baec1]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#2e406a]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#2baec1] rounded-full animate-float"></div>
        <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-[#2e406a] rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-xl w-full text-center bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-10 shadow-2xl animate-slide-up">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl gradient-primary mb-6 shadow-lg shadow-[#2baec1]/30">
          <span className="text-white font-black text-xl">404</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-black font-heading text-slate-900 mb-3">
          Page not found
        </h1>
        <p className="text-slate-600 mb-8">
          The page <span className="font-semibold text-slate-900">{location.pathname}</span> doesn’t exist (or was moved).
        </p>
        <a href="/">
          <Button className="gradient-primary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </a>
      </div>
    </div>
  );
};

export default NotFound;
