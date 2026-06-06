import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useGetAuthStatus, getGetAuthStatusQueryKey } from "@workspace/api-client-react";

import { Layout } from "@/components/layout";
import { Login } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { Campaigns } from "@/pages/campaigns";
import { CampaignDetail } from "@/pages/campaign-detail";
import { Posts } from "@/pages/posts";
import { Settings } from "@/pages/settings";

const queryClient = new QueryClient();

function AuthGuard() {
  const { data, isLoading } = useGetAuthStatus({ query: { queryKey: getGetAuthStatusQueryKey() } });
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background text-foreground dark">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isAuthenticated = data?.authenticated;

  if (!isAuthenticated) {
    if (location !== "/") setLocation("/");
    return <Login />;
  }

  if (location === "/") {
    setLocation("/dashboard");
    return null;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/posts" component={Posts} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGuard />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
