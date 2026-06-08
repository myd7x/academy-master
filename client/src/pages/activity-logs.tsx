import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Shield, Search, Filter, History, Package, Wallet, Settings, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { type ActivityLog } from "@shared/schema";

export default function ActivityLogs() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: ["/api/activity-logs", { entityType: entityTypeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityTypeFilter && entityTypeFilter !== "all") {
        params.append("entityType", entityTypeFilter);
      }
      params.append("limit", "100"); // Fetching 100 recent for now
      const res = await fetch(`/api/activity-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    }
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'expense': return <Wallet className="h-4 w-4 text-blue-500" />;
      case 'inventory_item': return <Package className="h-4 w-4 text-amber-500" />;
      case 'inventory_transaction': return <History className="h-4 w-4 text-green-500" />;
      default: return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action === 'created' || action === 'stock_in') return "bg-green-100 text-green-700 hover:bg-green-100";
    if (action === 'deleted' || action === 'stock_out') return "bg-red-100 text-red-700 hover:bg-red-100";
    if (action === 'updated' || action === 'adjustment') return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    return "bg-gray-100 text-gray-700 hover:bg-gray-100";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-academy-blue" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground">Global activity trail for system changes and transactions.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="px-6 py-4 border-b">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md">
              <Filter className="w-4 h-4 ml-2 text-muted-foreground" />
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-[180px] h-8 border-0 bg-transparent focus:ring-0">
                  <SelectValue placeholder="Filter by Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                  <SelectItem value="inventory_item">Inventory Items</SelectItem>
                  <SelectItem value="inventory_transaction">Inventory Transactions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {data && <p className="text-sm text-muted-foreground">Showing latest 100 records</p>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data?.logs || data.logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No activity logs found.
            </div>
          ) : (
            <div className="rounded-md border-0 overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(log.entityType)}
                          <span className="capitalize font-medium text-sm">
                            {log.entityType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
                          ID: {log.entityId.substring(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`capitalize font-semibold text-[10px] ${getActionColor(log.action)}`}>
                          {log.action.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{log.description}</div>
                        {log.metadata && (
                          <div className="text-[10px] text-muted-foreground mt-1 font-mono bg-gray-50/50 p-1 rounded border overflow-x-auto max-w-[300px]">
                            {log.metadata}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {log.performedBy ? (
                            <span className="truncate max-w-[100px]">{log.performedBy.substring(0, 8)}...</span>
                          ) : (
                            <span className="text-muted-foreground italic">System / Admin</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
