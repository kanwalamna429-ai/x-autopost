import { 
  useGetXAccount, getGetXAccountQueryKey,
  useConnectXAccount,
  useDisconnectXAccount,
  useTestXAccount
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Twitter, LogOut, Link2, Zap } from "lucide-react";
import { format } from "date-fns";

export function Settings() {
  const { data: account, isLoading } = useGetXAccount({ query: { queryKey: getGetXAccountQueryKey() } });
  
  const connectX = useConnectXAccount({ query: { enabled: false } });
  const disconnectX = useDisconnectXAccount();
  const testX = useTestXAccount();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      const res = await connectX.refetch();
      if (res.data?.url) {
        window.open(res.data.url, "_blank");
        toast({ title: "Opening X authorization..." });
      }
    } catch (e) {
      toast({ title: "Error initiating connect", variant: "destructive" });
    }
  };

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect your X account? Auto-posting will stop.")) return;
    disconnectX.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetXAccountQueryKey() });
        toast({ title: "Account disconnected" });
      }
    });
  };

  const handleTest = () => {
    testX.mutate(undefined, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ title: "Connection Successful", description: "The API can successfully reach X." });
        } else {
          toast({ title: "Connection Failed", description: res.message, variant: "destructive" });
        }
      }
    });
  };

  if (isLoading) {
    return <div className="h-[200px] w-full max-w-2xl bg-muted animate-pulse rounded-xl"></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Twitter className="w-5 h-5 text-[#1DA1F2]" />
            X (Twitter) Integration
          </CardTitle>
          <CardDescription>
            Connect your X account to enable automated posting for your campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {account?.connected ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                <Avatar className="h-16 w-16 border-2 border-border">
                  <AvatarImage src={account.profileImageUrl || ""} alt={account.username || ""} />
                  <AvatarFallback>{account.username?.charAt(0).toUpperCase() || "X"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold truncate">{account.displayName || "Unknown"}</h4>
                  <p className="text-sm text-muted-foreground truncate">@{account.username || "unknown"}</p>
                  {account.connectedAt && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      Connected on {format(new Date(account.connectedAt), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  CONNECTED
                </Badge>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleTest} disabled={testX.isPending}>
                  <Zap className="w-4 h-4 mr-2" />
                  {testX.isPending ? "Testing..." : "Test Connection"}
                </Button>
                <Button variant="destructive" onClick={handleDisconnect} disabled={disconnectX.isPending}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Link2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                No account connected. You need to authorize this app to post on your behalf.
              </p>
              <Button onClick={handleConnect} className="bg-[#1DA1F2] text-white hover:bg-[#1DA1F2]/90">
                <Twitter className="w-4 h-4 mr-2" fill="currentColor" />
                Connect X Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Ensure Badge is imported if missing locally or create simple fallback if needed
function Badge({ children, variant, className }: any) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>
}
