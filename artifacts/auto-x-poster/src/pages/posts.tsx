import { useGetPosts, getGetPostsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, ExternalLink, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Posts() {
  const { data: posts, isLoading } = useGetPosts({ query: { queryKey: getGetPostsQueryKey() } });

  if (isLoading) {
    return <div className="h-[400px] w-full bg-muted animate-pulse rounded-xl"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Post History</h2>
      </div>

      <Card className="bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[140px]">Date</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Article</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p>No posts published yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              posts?.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {format(new Date(post.postedAt), "MMM d, yyyy")}
                    <br/>
                    <span className="text-muted-foreground">{format(new Date(post.postedAt), "HH:mm:ss")}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {post.campaignName || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px] truncate text-sm font-medium">
                      {post.articleTitle || "Untitled"}
                    </div>
                    {post.articleUrl && (
                      <div className="max-w-[300px] truncate text-xs text-muted-foreground mt-0.5">
                        {post.articleUrl}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {post.status === "success" ? (
                      <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">SUCCESS</Badge>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="destructive" className="cursor-help flex w-fit items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> FAILED
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[200px] text-xs">{post.errorMessage || "Unknown error"}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {post.tweetUrl && (
                      <a 
                        href={post.tweetUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 py-1.5 rounded"
                      >
                        View Post <ExternalLink className="w-3 h-3 ml-1.5" />
                      </a>
                    )}
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
