import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertExpenseSchema, type InsertExpense } from "@shared/schema";
import { EXPENSE_CATEGORY_VALUES, PAYMENT_METHOD_VALUES, EXPENSE_STATUS_VALUES } from "@shared/schema";
import { Upload, FileText, X, Download } from "lucide-react";

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseToEdit?: any;
}

export default function AddExpenseModal({ open, onOpenChange, expenseToEdit }: AddExpenseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!expenseToEdit;
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const form = useForm<InsertExpense>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      category: expenseToEdit?.category || "other",
      amount: expenseToEdit?.amount?.toString() || "",
      date: expenseToEdit ? new Date(expenseToEdit.date) : new Date(),
      description: expenseToEdit?.description || "",
      paymentMethod: expenseToEdit?.paymentMethod || "cash",
      status: expenseToEdit?.status || "pending",
      notes: expenseToEdit?.notes || "",
    },
  });

  useEffect(() => {
    if (open && expenseToEdit) {
      form.reset({
        category: expenseToEdit.category || "other",
        amount: expenseToEdit.amount?.toString() || "",
        date: new Date(expenseToEdit.date),
        description: expenseToEdit.description || "",
        paymentMethod: expenseToEdit.paymentMethod || "cash",
        status: expenseToEdit.status || "pending",
        notes: expenseToEdit.notes || "",
      });
      if (expenseToEdit.receiptUrl) {
        setReceiptPreview(expenseToEdit.receiptUrl);
      }
    } else if (open) {
      form.reset({
        category: "other",
        amount: "",
        date: new Date(),
        description: "",
        paymentMethod: "cash",
        status: "pending",
        notes: "",
      });
      setReceiptFile(null);
      setReceiptPreview(null);
    }
  }, [open, expenseToEdit, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setReceiptPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setReceiptPreview(null);
      }
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const mutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      const url = isEditing ? `/api/expenses/${expenseToEdit.id}` : "/api/expenses";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${isEditing ? "update" : "add"} expense`);
      }

      const result = await response.json();

      // Upload receipt if file selected
      if (receiptFile) {
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        const expenseId = isEditing ? expenseToEdit.id : result.id;
        await fetch(`/api/expenses/${expenseId}/receipt`, {
          method: 'POST',
          body: formData,
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/expense-trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
      toast({
        title: `Expense ${isEditing ? "updated" : "added"}`,
        description: `Successfully ${isEditing ? "updated" : "added"} expense record.`,
      });
      setReceiptFile(null);
      setReceiptPreview(null);
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await fetch(`/api/expenses/${expenseToEdit.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete expense");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/expense-trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
      toast({
        title: "Expense deleted",
        description: "The expense record has been removed.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    const reason = window.prompt("Please enter a reason for deleting this expense:");
    if (reason !== null) {
      deleteMutation.mutate(reason || "Deleted by user");
    }
  };

  const onSubmit = (data: InsertExpense) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORY_VALUES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'pending'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_STATUS_VALUES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHOD_VALUES.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="What was this expense for?" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional details..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Receipt Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Receipt (Optional)</label>
              {receiptFile || (receiptPreview && !receiptFile) ? (
                <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  {receiptPreview && receiptPreview.startsWith('data:image') ? (
                    <img src={receiptPreview} alt="Receipt" className="w-12 h-12 object-cover rounded" />
                  ) : receiptPreview ? (
                    <a href={receiptPreview} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-sm">
                      <Download className="w-4 h-4" /> View Receipt
                    </a>
                  ) : (
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {receiptFile?.name || 'Existing receipt'}
                    </p>
                    {receiptFile && (
                      <p className="text-xs text-muted-foreground">
                        {(receiptFile.size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={removeReceipt}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload receipt (PDF, JPG, PNG)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            <div className="flex justify-between pt-4">
              {isEditing ? (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              ) : (
                <div></div>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : "Save Expense"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
