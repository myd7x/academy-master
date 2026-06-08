import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertInventoryTransactionSchema, type InsertInventoryTransaction, type InventoryItem, EXPENSE_CATEGORY_VALUES, PAYMENT_METHOD_VALUES } from "@shared/schema";
import * as z from "zod";

const transactionFormSchema = insertInventoryTransactionSchema.extend({
  createExpense: z.boolean().optional(),
  unitCost: z.number().min(0).optional(),
  expenseCategory: z.enum(EXPENSE_CATEGORY_VALUES as any).optional(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES as any).optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface InventoryTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | undefined;
  type: 'in' | 'out' | 'adjustment';
}

export default function InventoryTransactionModal({ open, onOpenChange, item, type }: InventoryTransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      itemId: item?.id || "",
      type: type,
      quantity: 0,
      transactionDate: new Date(),
      reference: "",
      notes: "",
      createExpense: false,
      unitCost: item ? parseFloat(item.unitPrice as any) || 0 : 0,
      expenseCategory: 'equipment',
      paymentMethod: 'cash',
    },
  });

  const createExpense = form.watch("createExpense");

  // Reset form when item or type changes
  useEffect(() => {
    if (item && open) {
      form.reset({
        itemId: item.id,
        type: type,
        quantity: 0,
        transactionDate: new Date(),
        reference: "",
        notes: "",
        createExpense: false,
        unitCost: parseFloat(item.unitPrice as any) || 0,
        expenseCategory: 'equipment',
        paymentMethod: 'cash',
      });
    }
  }, [item, type, open, form]);

  const mutation = useMutation({
    mutationFn: async (data: TransactionFormValues) => {
      const response = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          unitCostAtTransaction: data.unitCost?.toString()
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process transaction");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${item?.id}/transactions`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Transaction Successful",
        description: `Successfully processed inventory ${type}.`,
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransactionFormValues) => {
    if (type === 'adjustment' && (!data.notes || data.notes.trim() === '')) {
      form.setError('notes', { type: 'manual', message: 'Notes are required for inventory adjustments' });
      return;
    }
    mutation.mutate(data);
  };

  if (!item) return null;

  const titles = {
    in: "Stock In",
    out: "Stock Out",
    adjustment: "Inventory Adjustment"
  };

  const descriptions = {
    in: "Add new stock to your inventory.",
    out: "Remove stock from your inventory (e.g., used, sold).",
    adjustment: "Correct the current inventory quantity (can be positive or negative to represent difference)."
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[type]} - {item.name}</DialogTitle>
          <DialogDescription>{descriptions[type]}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted p-3 rounded-md mb-4 flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Current Quantity:</span>
          <span className="font-bold">{item.quantity}</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {type === 'adjustment' ? 'Quantity Difference (+ or -)' : 'Quantity'}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={type === 'adjustment' ? undefined : 1}
                      placeholder={type === 'adjustment' ? "+5 or -2" : "10"} 
                      {...field} 
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transactionDate"
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

            {type === 'in' && (
              <div className="space-y-4 border p-4 rounded-md mt-4">
                <FormField
                  control={form.control}
                  name="createExpense"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Create related expense for this purchase
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {createExpense && (
                  <div className="space-y-4 pt-2">
                    <FormField
                      control={form.control}
                      name="unitCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Cost (AED)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              min="0"
                              {...field} 
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="text-sm font-medium text-muted-foreground text-right pb-2 border-b">
                      Total Expense: AED {(form.watch('quantity') * (form.watch('unitCost') || 0)).toFixed(2)}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="expenseCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expense Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EXPENSE_CATEGORY_VALUES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
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
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PAYMENT_METHOD_VALUES.map((method) => (
                                <SelectItem key={method} value={method}>
                                  {method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PO-1234 or Invoice #99" {...field} value={field.value || ''} />
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
                  <FormLabel>{type === 'adjustment' ? 'Notes (Required)' : 'Notes (Optional)'}</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Reason for transaction..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Processing..." : "Confirm Transaction"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
