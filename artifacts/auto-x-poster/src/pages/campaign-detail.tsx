import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetCampaign, getGetCampaignQueryKey,
  useGetCampaignStats, getGetCampaignStatsQueryKey,
  useGetCampaignUrls, getGetCampaignUrlsQueryKey,
  useAddUrls, useDeleteUrl, useTriggerCampaign, useUpdateCampaign,
  getGetCampaignsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Play, Pause, Zap, Link as LinkIcon, Trash2, Settings2, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CampaignDetail() {
  const { id: idStr } = useParams();
  const id = parseInt(idStr || "0", 10);
  const [urlInput, setUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: campaign, isLoading: isC } = useGetCampaign(id, { query: { enabled: !!id, queryKey: getGetCampaignQueryKey(id) } });
  const { data: stats, isLoading: isS } = useGetCampaignStats(id, { query: { enabled: !!id, queryKey: getGetCampaignStatsQueryKey(id) } });
  const { data: urls, isLoading: isU } = useGetCampaignUrls(id, { query: { enabled: !!id, queryKey: getGetCampaignUrlsQueryKey(id) } });

  const updateCampaign = useUpdateCampaign();
  const addUrls = useAddUrls();
  const deleteUrl = useDeleteUrl();
  const triggerCampaign = useTriggerCampaign();

  const handleToggleStatus = () => {
    if (!campaign) return;
    const newStatus = campaign.status === "active" ? "paused" : "active";
    updateCampaign.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        toast({ title: `Campaign ${newStatus}` });
      }
    });
  };

  const handleAddUrls = () => {
    if (!urlInput.trim()) return;
    const urlsToAdd = urlInput.split("\n").map(u => u.trim()).filter(Boolean);
    
    addUrls.mutate({ id, data: { urls: urlsToAdd } }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignUrlsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCampaignStatsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        toast({ 
          title: "URLs Added", 
          description: `${res.added} added, ${res.duplicates} duplicates skipped.` 
        });
        setUrlInput("");
      }
    });
  };

  const handleDeleteUrl = (urlId: number) => {
    if (!confirm("Remove this URL?")) return;
    deleteUrl.mutate({ campaignId: id, urlId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignUrlsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCampaignStatsQueryKey(id) });
      }
    });
  };

  const handleTrigger = () => {
    if (!confirm("Force post right now? This will ignore the schedule constraints.")) return;
    triggerCampaign.mutate({ id }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignUrlsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCampaignStatsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        if (res.success) {
          toast({ title: "Posted successfully", description: "View in Post History." });
        } else {
          toast({ title: "Trigger failed", description: res.message, variant: "destructive" });
        }
      }
    });
  };

  if (isC || isS || isU || !campaign) {
    return <div className="animate-pulse space-y-6">
      <div className="h-10 w-1/3 bg-muted rounded"></div>
      <div className="h-24 w-full bg-muted rounded"></div>
      <div className="h-[400px] w-full bg-muted rounded"></div>
    </div>;
  }

  const filteredUrls = urls?.filter(u => {
    if (activeTab === "pending") return !u.posted && !u.failed;
    if (activeTab === "posted") return u.posted;
    if (activeTab === "failed") return u.failed;
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-2">
            <ArrowLeft className="w-3 h-3 mr-1" /> Back to campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{campaign.name}</h2>
            <Badge variant={campaign.status === "active" ? "default" : "secondary"} className="uppercase font-mono tracking-wider">
              {campaign.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline"><Settings2 className="w-4 h-4 mr-2" /> Settings</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <CampaignSettingsForm campaign={campaign} />
            </PopoverContent>
          </Popover>
          <Button 
            variant="outline" 
            onClick={handleToggleStatus}
            className="w-[110px]"
          >
            {campaign.status === "active" ? <><Pause className="w-4 h-4 mr-2" /> Pause</> : <><Play className="w-4 h-4 mr-2" /> Resume</>}
          </Button>
          <Button onClick={handleTrigger} disabled={triggerCampaign.isPending || stats?.pending === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Zap className="w-4 h-4 mr-2" /> 
            {triggerCampaign.isPending ? "Posting..." : "Force Post"}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total URLs</div>
            <div className="text-2xl font-bold font-mono">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Pending</div>
            <div className="text-2xl font-bold font-mono text-blue-400">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Posted</div>
            <div className="text-2xl font-bold font-mono text-emerald-500">{stats?.posted || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">Failed</div>
            <div className="text-2xl font-bold font-mono text-destructive">{stats?.failed || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Col: URL List */}
        <div className="md:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-muted">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="posted">Posted</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
              </TabsList>
              {campaign.nextPostAt && campaign.status === 'active' && (
                <div className="text-sm text-muted-foreground font-mono">
                  Next post: {format(new Date(campaign.nextPostAt), "HH:mm")}
                </div>
              )}
            </div>

            <TabsContent value={activeTab} className="m-0 space-y-3">
              {filteredUrls?.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
                  <LinkIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p>No URLs found for this filter.</p>
                </div>
              ) : (
                filteredUrls?.map((url) => (
                  <Card key={url.id} className="bg-card overflow-hidden group">
                    <div className="flex h-full">
                      {/* Image Thumbnail */}
                      <div className="w-24 shrink-0 bg-muted flex items-center justify-center border-r border-border overflow-hidden relative">
                        {url.generatedImageUrl || url.imageUrl ? (
                          <img src={url.generatedImageUrl || url.imageUrl || ""} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 opacity-20" />
                        )}
                        {url.generatedImageUrl && (
                          <div className="absolute bottom-1 right-1 bg-black/70 text-[9px] px-1 rounded text-white font-mono">AI</div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm leading-tight line-clamp-1 flex-1">
                              {url.title || "Pending extraction..."}
                            </h4>
                            <Badge variant={url.failed ? "destructive" : url.posted ? "outline" : "secondary"} className="text-[10px] h-4 px-1 py-0">
                              {url.failed ? "FAILED" : url.posted ? "POSTED" : "QUEUED"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">{url.url}</p>
                        </div>
                        
                        <div className="flex items-end justify-between mt-2">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {url.postedAt ? `Posted ${format(new Date(url.postedAt), "MMM d")}` : `Added ${format(new Date(url.createdAt), "MMM d")}`}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={() => handleDeleteUrl(url.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Col: Add URLs */}
        <div className="space-y-4">
          <Card className="bg-card">
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Add URLs</h3>
                <p className="text-xs text-muted-foreground">Paste one URL per line.</p>
              </div>
              <Textarea 
                placeholder="https://example.com/article-1&#10;https://example.com/article-2" 
                className="min-h-[200px] font-mono text-xs resize-y"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <Button 
                className="w-full" 
                onClick={handleAddUrls} 
                disabled={addUrls.isPending || !urlInput.trim()}
              >
                {addUrls.isPending ? "Adding..." : "Queue URLs"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CampaignSettingsForm({ campaign }: { campaign: any }) {
  const [data, setData] = useState({
    name: campaign.name,
    frequencyHours: campaign.frequencyHours.toString(),
    postingMode: campaign.postingMode,
    recycleEnabled: campaign.recycleEnabled,
    addHashtags: campaign.addHashtags,
    ctaText: campaign.ctaText || ""
  });
  const updateCampaign = useUpdateCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSave = () => {
    updateCampaign.mutate({
      id: campaign.id,
      data: {
        ...data,
        frequencyHours: parseInt(data.frequencyHours, 10),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaign.id) });
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
        toast({ title: "Settings saved" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm border-b border-border pb-2">Campaign Settings</h4>
      
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input 
          className="h-8 text-sm" 
          value={data.name} 
          onChange={e => setData({...data, name: e.target.value})} 
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Frequency</Label>
          <Select value={data.frequencyHours} onValueChange={v => setData({...data, frequencyHours: v})}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
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
        <div className="space-y-1.5">
          <Label className="text-xs">Mode</Label>
          <Select value={data.postingMode} onValueChange={v => setData({...data, postingMode: v as any})}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">Sequential</SelectItem>
              <SelectItem value="random">Random</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">CTA Text (appended to posts)</Label>
        <Input 
          className="h-8 text-sm" 
          placeholder="Read more:" 
          value={data.ctaText} 
          onChange={e => setData({...data, ctaText: e.target.value})} 
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <Label className="text-xs font-normal">Add relevant hashtags</Label>
        <Switch checked={data.addHashtags} onCheckedChange={c => setData({...data, addHashtags: c})} />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-normal">Recycle URLs</Label>
        <Switch checked={data.recycleEnabled} onCheckedChange={c => setData({...data, recycleEnabled: c})} />
      </div>

      <Button className="w-full h-8 text-xs mt-4" onClick={handleSave} disabled={updateCampaign.isPending}>
        Save Changes
      </Button>
    </div>
  );
}
