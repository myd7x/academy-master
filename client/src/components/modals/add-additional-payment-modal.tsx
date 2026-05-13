import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PAYMENT_METHODS } from "@/lib/constants";

const addPaymentSchema = z.object({
  playerId: z.string().min(1, "Player ID is required"),
  amountPaid: z.string().min(1, "Amount paid is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  description: z.string().optional(),
});

type AddPaymentForm = z.infer<typeof addPaymentSchema>;

interface AddAdditionalPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId?: string;
  playerName?: string;
}

export default function AddAdditionalPaymentModal({ 
  open, 
  onOpenChange, 
  playerId,
  playerName
}: AddAdditionalPaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch player payments to calculate remaining balance
  const { data: playerPayments } = useQuery({
    queryKey: ["/api/payments", "player", playerId],
    queryFn: () => fetch(`/api/payments?playerId=${playerId}`).then(res => res.json()),
    enabled: !!playerId && open,
  });

  const { data: player } = useQuery({
    queryKey: ["/api/players", playerId],
    queryFn: () => fetch(`/api/players/${playerId}`).then(res => res.json()),
    enabled: !!playerId && open,
  });

  const calculateRemainingBalance = () => {
    if (!player || !playerPayments) return 0;
    
    const subscriptionFee = parseFloat(player.monthlySubscriptionFee || "0");
    const totalPaid = playerPayments.reduce((sum: number, payment: any) => {
      return sum + parseFloat(payment.amountPaid || "0");
    }, 0);
    
    return Math.max(0, subscriptionFee - totalPaid);
  };

  const remainingBalance = calculateRemainingBalance();

  const form = useForm<AddPaymentForm>({
    resolver: zodResolver(addPaymentSchema),
    defaultValues: {
      playerId: playerId || "",
      amountPaid: "",
      paymentMethod: "cash",
      description: "Additional subscription payment",
    },
  });

  // Reset form when modal opens with new player data
  React.useEffect(() => {
    if (open && playerId) {
      form.reset({
        playerId: playerId,
        amountPaid: "",
        paymentMethod: "cash",
        description: `Additional payment for ${playerName || 'player'}`,
      });
    }
  }, [open, playerId, playerName, form]);

  const addPaymentMutation = useMutation({
    mutationFn: async (data: AddPaymentForm) => {
      const response = await fetch("/api/payments/additional", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add payment");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Payment added successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddPaymentForm) => {
    addPaymentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Additional Payment</DialogTitle>
          <DialogDescription>
            {playerName ? `Make an additional payment for ${playerName}` : "Make an additional payment for the selected player"}
            {remainingBalance > 0 && ` (Remaining Balance: AED ${remainingBalance.toFixed(2)})`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* History View */}
            {playerPayments && (playerPayments as any[]).length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2">Previous Payments</h5>
                <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                  {([...playerPayments as any[]])
                    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                    .map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border text-xs">
                        <div>
                          <div className="font-medium">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</div>
                          <div className="text-gray-500">{p.receiptNumber}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">${p.amountPaid}</div>
                          <div className="text-gray-500">{PAYMENT_METHODS[p.paymentMethod as keyof typeof PAYMENT_METHODS]?.label || p.paymentMethod}</div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="amountPaid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Pay ($) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={remainingBalance > 0 ? remainingBalance : undefined}
                      placeholder="0.00"
                      {...field}
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
                  <FormLabel>Payment Method *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHODS).map(([key, method]) => (
                        <SelectItem key={key} value={key}>
                          {method.icon} {method.label}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Payment description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-academy-blue hover:bg-academy-blue-light text-white"
                disabled={addPaymentMutation.isPending}
              >
                {addPaymentMutation.isPending ? "Adding..." : "Add Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}