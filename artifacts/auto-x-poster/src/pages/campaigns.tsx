import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetCampaigns, 
  getGetCampaignsQueryKey,
  useUpdateCampaign,
  useCreateCampaign,
  useDeleteCampaign
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Play, Pause, MoreVertical, Trash, Edit, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export function Campaigns() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: campaigns, isLoading } = useGetCampaigns({ query: { queryKey: getGetCampaignsQueryKey() } });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const toggleStatus = (id: number, currentStatus: "active" | "paused") => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    updateCampaign.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
        toast({ title: `Campaign ${newStatus}` });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this campaign? All its URLs and history will be deleted as well.")) return;
    deleteCampaign.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
        toast({ title: "Campaign deleted" });
      }
    });
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 bg-muted rounded"></div>
      <div className="h-[400px] w-full bg-muted rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
        <CreateCampaignDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead className="text-right">URLs</TableHead>
              <TableHead>Next Post</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Settings2 className="w-8 h-8 opacity-20" />
                    <p>No campaigns yet.</p>
                    <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>Create your first campaign</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              campaigns?.map((campaign) => (
                <TableRow key={campaign.id} className="group">
                  <TableCell className="font-medium">
                    <Link href={`/campaigns/${campaign.id}`} className="hover:text-primary transition-colors">
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={campaign.status === "active" ? "default" : "secondary"} className="font-mono text-xs uppercase tracking-wider">
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    Every {campaign.frequencyHours}h &middot; {campaign.postingMode}
                  </TableCell>
                  <TableCell className="text-right font-mono">{campaign.urlCount || 0}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground whitespace-nowrap">
                    {campaign.status === "active" && campaign.nextPostAt 
                      ? format(new Date(campaign.nextPostAt), "MMM d, HH:mm") 
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => toggleStatus(campaign.id, campaign.status)}>
                          {campaign.status === "active" ? (
                            <><Pause className="mr-2 h-4 w-4" /> Pause</>
                          ) : (
                            <><Play className="mr-2 h-4 w-4" /> Resume</>
                          )}
                        </DropdownMenuItem>
                        <Link href={`/campaigns/${campaign.id}`}>
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(campaign.id)}>
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CreateCampaignDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [frequencyHours, setFrequencyHours] = useState("4");
  const [postingMode, setPostingMode] = useState<"sequential" | "random">("sequential");
  
  const createCampaign = useCreateCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    createCampaign.mutate({
      data: {
        name,
        frequencyHours: parseInt(frequencyHours, 10),
        postingMode,
        status: "paused",
        recycleEnabled: false,
        addHashtags: true
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
        toast({ title: "Campaign created" });
        onOpenChange(false);
        setName("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> New Campaign</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Evergreen Blog Posts" autoFocus />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequencyHours} onValueChange={setFrequencyHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Every 1h</SelectItem>
                  <SelectItem value="2">Every 2h</SelectItem>
                  <SelectItem value="4">Every 4h</SelectItem>
                  <SelectItem value="6">Every 6h</SelectItem>
                  <SelectItem value="12">Every 12h</SelectItem>
                  <SelectItem value="24">Every 24h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Posting Mode</Label>
              <Select value={postingMode} onValueChange={(v: "sequential" | "random") => setPostingMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name || createCampaign.isPending}>
              {createCampaign.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
