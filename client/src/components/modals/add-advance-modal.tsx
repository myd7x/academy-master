import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Trainer {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainer: Trainer | null;
}

export default function AddAdvanceModal({ open, onOpenChange, trainer }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setAmount("");
    setNotes("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/trainers/${trainer!.id}/advances`, {
        amount: parseFloat(amount),
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trainers", trainer?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Advance recorded",
        description: `AED ${parseFloat(amount).toLocaleString()} advance for ${trainer?.name} (status: pending)`,
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !trainer) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Record Advance</DialogTitle>
          {trainer && (
            <p className="text-sm text-muted-foreground mt-1">
              Trainer: <strong>{trainer.name}</strong>
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
            ⚠️ This advance will be marked as <strong>pending</strong>. It will only be deducted from salary
            when you explicitly select it during a salary payment.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="advance-amount">Advance Amount (AED)</Label>
            <Input
              id="advance-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="advance-notes">Notes (optional)</Label>
            <Textarea
              id="advance-notes"
              placeholder="e.g. Emergency advance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving…" : "Record Advance"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
