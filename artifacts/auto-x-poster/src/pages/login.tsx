import { useState } from "react";
import { useLogin, getGetAuthStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "lucide-react";

export function Login() {
  const [password, setPassword] = useState("");
  const login = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    login.mutate(
      { data: { password } },
      {
        onSuccess: (data) => {
          if (data.authenticated) {
            queryClient.invalidateQueries({ queryKey: getGetAuthStatusQueryKey() });
          } else {
            toast({ title: "Login failed", description: "Invalid password", variant: "destructive" });
          }
        },
        onError: () => {
          toast({ title: "Error", description: "An error occurred during login", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground dark p-4">
      <div className="w-full max-w-sm flex flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-mono font-bold tracking-tight">AUTO X POSTER</h1>
            <p className="text-muted-foreground text-sm">Command center access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4 bg-card p-6 rounded-xl border border-border shadow-xl">
          <div className="space-y-2">
            <Label htmlFor="password">Passphrase</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background font-mono"
              autoFocus
            />
          </div>
          <Button 
            type="submit" 
            className="w-full font-mono" 
            disabled={login.isPending || !password}
          >
            {login.isPending ? "AUTHENTICATING..." : "INITIALIZE"}
          </Button>
        </form>
      </div>
    </div>
  );
}
