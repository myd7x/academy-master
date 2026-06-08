import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Wallet, Filter, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AddExpenseModal from "@/components/modals/add-expense-modal";
import { type Expense, EXPENSE_CATEGORY_VALUES } from "@shared/schema";

export default function Expenses() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | undefined>();
  const [monthFilter, setMonthFilter] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { month: monthFilter, category: categoryFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (monthFilter && monthFilter !== "all") params.append("month", monthFilter);
      if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
      const res = await fetch(`/api/expenses?${params}`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    }
  });

  const handleEdit = (expense: Expense) => {
    if (expense.category === 'salary') return; // salary rows come from payroll; edit there
    setExpenseToEdit(expense);
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setTimeout(() => setExpenseToEdit(undefined), 300);
  };

  const totalAmount = expenses?.reduce((sum, e) => sum + parseFloat(e.amount as any), 0) || 0;

  const statusBadgeClass = (status: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700';
    if (status === 'approved') return 'bg-blue-100 text-blue-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-8 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Manage and track your academy's expenses.</p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Expense</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 sm:p-8">
        <div className="space-y-6 max-w-7xl mx-auto">

          {/* Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">AED {totalAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">For selected month and category</p>
            </CardContent>
          </Card>

          {/* Records */}
          <Card>
            <CardHeader className="px-4 sm:px-6 py-4 border-b">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <CardTitle className="text-lg">Expense Records</CardTitle>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-md">
                    <Filter className="w-4 h-4 ml-1 text-muted-foreground shrink-0" />
                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                      <SelectTrigger className="w-[130px] h-8 border-0 bg-transparent focus:ring-0 text-xs sm:text-sm">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const d = new Date();
                          d.setMonth(d.getMonth() - i);
                          const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                          return (
                            <SelectItem key={val} value={val}>
                              {format(d, 'MMM yyyy')}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-md">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[130px] h-8 border-0 bg-transparent focus:ring-0 text-xs sm:text-sm">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {EXPENSE_CATEGORY_VALUES.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
              ) : !expenses || expenses.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No expenses found for the selected filters.
                </div>
              ) : (
                <>
                  {/* ── Mobile card list (< md) ────────────────────────── */}
                  <div className="md:hidden divide-y">
                    {expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="p-4 cursor-pointer hover:bg-muted/50 active:bg-muted"
                        onClick={() => handleEdit(expense)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {format(new Date(expense.date), "dd MMM yyyy")}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                                {expense.category}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(expense.status || 'pending')}`}>
                                {expense.status || 'pending'}
                              </span>
                            </div>
                            {expense.description && (
                              <p className="text-sm text-muted-foreground truncate">{expense.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                              {expense.paymentMethod.replace('_', ' ')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-red-600 text-sm">
                              AED {parseFloat(expense.amount as any).toFixed(2)}
                            </p>
                            {expense.receiptUrl && (
                              <a
                                href={expense.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-blue-600 text-xs mt-1"
                              >
                                <Paperclip className="w-3 h-3" /> Receipt
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Desktop table (≥ md) ───────────────────────────── */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead className="text-center">Receipt</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((expense) => (
                          <TableRow
                            key={expense.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleEdit(expense)}
                          >
                            <TableCell className="font-medium">
                              {format(new Date(expense.date), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                                {expense.category}
                              </span>
                            </TableCell>
                            <TableCell>{expense.description || "-"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(expense.status || 'pending')}`}>
                                {expense.status || 'pending'}
                              </span>
                            </TableCell>
                            <TableCell className="capitalize">{expense.paymentMethod.replace('_', ' ')}</TableCell>
                            <TableCell className="text-center">
                              {expense.receiptUrl ? (
                                <a
                                  href={expense.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  <Paperclip className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              AED {parseFloat(expense.amount as any).toFixed(2)}
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

      <AddExpenseModal
        open={isAddModalOpen}
        onOpenChange={handleCloseModal}
        expenseToEdit={expenseToEdit}
      />
    </>
  );
}
