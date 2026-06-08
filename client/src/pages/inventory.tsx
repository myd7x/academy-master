import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Package, PackageMinus, PackagePlus, Edit2, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

import AddInventoryItemModal from "@/components/modals/add-inventory-item-modal";
import InventoryTransactionModal from "@/components/modals/inventory-transaction-modal";
import { type InventoryItem } from "@shared/schema";

const CATEGORY_OPTIONS = ['all', 'tools', 'apparel', 'consumables', 'equipment'];

export default function Inventory() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txItem, setTxItem] = useState<InventoryItem | undefined>();
  const [txType, setTxType] = useState<'in' | 'out' | 'adjustment'>('in');

  const { data: items, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory", { category: categoryFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
      const res = await fetch(`/api/inventory?${params}`);
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    }
  });

  const handleEdit = (item: InventoryItem) => {
    setItemToEdit(item);
    setIsAddModalOpen(true);
  };

  const handleTransaction = (item: InventoryItem, type: 'in' | 'out' | 'adjustment') => {
    setTxItem(item);
    setTxType(type);
    setTxModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setTimeout(() => setItemToEdit(undefined), 300);
  };

  const closeTxModal = () => {
    setTxModalOpen(false);
    setTimeout(() => setTxItem(undefined), 300);
  };

  const totalItems = items?.length || 0;
  const lowStockItems = items?.filter(i => i.quantity <= i.minQuantity && i.quantity > 0)?.length || 0;
  const outOfStockItems = items?.filter(i => i.quantity <= 0)?.length || 0;
  const totalValue = items?.reduce((sum, item) => sum + (item.quantity > 0 && item.unitPrice ? item.quantity * parseFloat(item.unitPrice as any) : 0), 0) || 0;

  const conditionClass = (condition: string) => {
    if (condition === 'new') return 'bg-green-100 text-green-700';
    if (condition === 'good') return 'bg-blue-100 text-blue-700';
    if (condition === 'damaged') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  const ItemActions = ({ item }: { item: InventoryItem }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleTransaction(item, 'in')}>
          <PackagePlus className="mr-2 h-4 w-4" /> Stock In
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTransaction(item, 'out')} disabled={item.quantity <= 0}>
          <PackageMinus className="mr-2 h-4 w-4" /> Stock Out
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTransaction(item, 'adjustment')}>
          <Edit2 className="mr-2 h-4 w-4" /> Adjustment
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleEdit(item)}>
          Edit Item Details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-8 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Manage warehouse items and academy tools.</p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Item</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 sm:p-8">
        <div className="space-y-6 max-w-7xl mx-auto">

          {/* Stats — 2 cols on mobile, 4 on desktop */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium">Total Items</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{totalItems}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium">Out of Stock</CardTitle>
                <PackageMinus className="h-4 w-4 text-red-500 shrink-0" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-red-600">{outOfStockItems}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium">Low Stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-amber-600">{lowStockItems}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium">Est. Value</CardTitle>
                <span className="text-xs font-bold text-muted-foreground shrink-0">AED</span>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{totalValue.toFixed(0)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Items list */}
          <Card>
            <CardHeader className="px-4 sm:px-6 py-4 border-b">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <CardTitle className="text-lg">Inventory Items</CardTitle>
                <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md">
                  <Filter className="w-4 h-4 ml-1 text-muted-foreground shrink-0" />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[140px] h-8 border-0 bg-transparent focus:ring-0 text-xs sm:text-sm">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : !items || items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No inventory items found.
                </div>
              ) : (
                <>
                  {/* ── Mobile card list (< md) ───────────────────────── */}
                  <div className="md:hidden divide-y">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 ${item.quantity <= 0 ? 'bg-red-50/50' : item.quantity <= item.minQuantity ? 'bg-amber-50/50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Left: name + meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                              <span className="font-medium text-sm text-gray-900 truncate">{item.name}</span>
                              {item.quantity <= 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Out</Badge>}
                              {item.quantity > 0 && item.quantity <= item.minQuantity && (
                                <Badge variant="outline" className="text-amber-600 border-amber-600 text-[10px] h-4 px-1.5">Low</Badge>
                              )}
                            </div>
                            {item.sku && (
                              <p className="text-xs text-muted-foreground mb-1">SKU: {item.sku}</p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                              <span className="text-xs text-muted-foreground capitalize">{item.category}</span>
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${conditionClass(item.condition || 'new')}`}>
                                {item.condition || 'new'}
                              </span>
                              {item.location && (
                                <span className="text-xs text-muted-foreground">{item.location}</span>
                              )}
                            </div>
                            {item.unitPrice && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                AED {parseFloat(item.unitPrice as any).toFixed(2)} / unit
                              </p>
                            )}
                          </div>

                          {/* Right: quantity + actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-2xl font-bold text-gray-900">{item.quantity}</span>
                            <ItemActions item={item} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Desktop table (≥ md) ──────────────────────────── */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow
                            key={item.id}
                            className={item.quantity <= 0 ? "bg-red-50/50" : item.quantity <= item.minQuantity ? "bg-amber-50/50" : ""}
                          >
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              {item.sku && <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>}
                            </TableCell>
                            <TableCell>
                              <span className="capitalize">{item.category}</span>
                            </TableCell>
                            <TableCell>{item.location || "-"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${conditionClass(item.condition || 'new')}`}>
                                {item.condition || 'new'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {item.quantity <= 0 && <Badge variant="destructive">Out</Badge>}
                                {item.quantity > 0 && item.quantity <= item.minQuantity && (
                                  <Badge variant="outline" className="text-amber-600 border-amber-600">Low</Badge>
                                )}
                                <span className="font-bold">{item.quantity}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.unitPrice ? `AED ${parseFloat(item.unitPrice as any).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell>
                              <ItemActions item={item} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </main>

      <AddInventoryItemModal
        open={isAddModalOpen}
        onOpenChange={closeAddModal}
        itemToEdit={itemToEdit}
      />

      <InventoryTransactionModal
        open={txModalOpen}
        onOpenChange={closeTxModal}
        item={txItem}
        type={txType}
      />
    </>
  );
}
