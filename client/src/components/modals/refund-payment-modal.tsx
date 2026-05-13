import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Calendar,
  CreditCard,
} from "lucide-react";
import { PAYMENT_METHODS } from "@/lib/constants";

// Standardized refund methods — must match server/storage.ts ALLOWED_REFUND_METHODS
const REFUND_METHODS: Record<string, { label: string; icon: string }> = {
  cash:          { label: 'Cash',          icon: '💵' },
  bank_transfer: { label: 'Bank Transfer', icon: '🏦' },
  card_reversal: { label: 'Card Reversal', icon: '💳' },
  wallet:        { label: 'Wallet',        icon: '👛' },
  adjustment:    { label: 'Adjustment',    icon: '⚙️'  },
};

interface RefundPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: any | null;
}

export default function RefundPaymentModal({
  open,
  onOpenChange,
  payment,
}: RefundPaymentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Reset form when modal opens with a new payment
  useEffect(() => {
    if (open && payment) {
      setRefundAmount("");
      setRefundMethod("cash");
      setReason("");
      setShowHistory(false);
    }
  }, [open, payment]);

  // Fetch existing refunds for this payment
  const { data: refundData } = useQuery({
    queryKey: ["/api/payments", payment?.id, "refunds"],
    queryFn: async () => {
      const res = await fetch(`/api/payments/${payment.id}/refunds`);
      if (!res.ok) throw new Error("Failed to fetch refunds");
      return res.json();
    },
    enabled: open && !!payment?.id,
  });

  const existingRefunds: any[] = refundData?.refunds ?? [];
  const summary = refundData?.summary ?? {
    totalRefunded: 0,
    remainingRefundable: parseFloat(payment?.amountPaid ?? "0"),
  };
  const totalRefunded = summary.totalRefunded ?? 0;
  const remainingRefundable = summary.remainingRefundable ?? 0;
  const amountPaid = parseFloat(payment?.amountPaid ?? "0");

  // Validation
  const refundAmountNum = parseFloat(refundAmount);
  const isAmountValid =
    !isNaN(refundAmountNum) &&
    refundAmountNum > 0 &&
    refundAmountNum <= remainingRefundable + 0.001;
  const isReasonValid = reason.trim().length >= 3;
  const canRefund =
    payment?.paymentStatus !== "cancelled" &&
    payment?.paymentStatus !== "refunded" &&
    remainingRefundable > 0.001;
  const isFormValid = isAmountValid && isReasonValid;

  const refundMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundAmount: refundAmountNum,
          refundMethod,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Refund failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Refund Processed",
        description: `AED ${refundAmountNum.toFixed(2)} refunded successfully.`,
      });
      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/payments", payment.id, "refunds"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/players", payment.playerId, "refunds"],
      });
      // Reset form — keep modal open to show updated history
      setRefundAmount("");
      setReason("");
      setShowHistory(true);
    },
    onError: (err: Error) => {
      toast({
        title: "Refund Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!payment) return null;

  const method =
    PAYMENT_METHODS[payment.paymentMethod as keyof typeof PAYMENT_METHODS];
  const pctRefunded =
    amountPaid > 0 ? Math.min(100, (totalRefunded / amountPaid) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="h-4 w-4 text-purple-600" />
            </div>
            <span>Process Refund</span>
          </DialogTitle>
          <DialogDescription>
            Issue a full or partial refund for this payment. Original payment is
            never modified.
          </DialogDescription>
        </DialogHeader>

        {/* ── Original Payment Card ───────────────────────────────────── */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Original Payment
            </span>
            <Badge className="text-xs font-mono">{payment.receiptNumber}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-medium">
                  {format(new Date(payment.paymentDate), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Method</p>
                <p className="text-sm font-medium">
                  {method?.icon} {method?.label}
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Refunded</span>
              <span className="font-medium">
                AED {totalRefunded.toFixed(2)} / AED {amountPaid.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  pctRefunded >= 100 ? "bg-purple-500" : "bg-indigo-500"
                }`}
                style={{ width: `${pctRefunded}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-white rounded-lg p-2 border">
              <p className="text-xs text-gray-500">Amount Paid</p>
              <p className="text-sm font-bold text-gray-900">
                AED {amountPaid.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 border">
              <p className="text-xs text-gray-500">Total Refunded</p>
              <p className="text-sm font-bold text-purple-600">
                AED {totalRefunded.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 border">
              <p className="text-xs text-gray-500">Refundable</p>
              <p
                className={`text-sm font-bold ${
                  remainingRefundable > 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                AED {remainingRefundable.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Fully Refunded Notice ───────────────────────────────────── */}
        {!canRefund && (
          <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-purple-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-900">
                {payment.paymentStatus === "refunded"
                  ? "This payment has been fully refunded."
                  : payment.paymentStatus === "cancelled"
                  ? "Cannot refund a cancelled payment."
                  : "No refundable amount remaining."}
              </p>
            </div>
          </div>
        )}

        {/* ── Refund Form ─────────────────────────────────────────────── */}
        {canRefund && (
          <div className="space-y-4">
            {/* Amount */}
            <div>
              <Label htmlFor="refund-amount" className="text-sm font-medium">
                Refund Amount{" "}
                <span className="text-gray-400 font-normal">
                  (max AED {remainingRefundable.toFixed(2)})
                </span>
              </Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                  AED
                </span>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingRefundable}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className={`pl-12 ${
                    refundAmount && !isAmountValid
                      ? "border-red-400 focus-visible:ring-red-400"
                      : ""
                  }`}
                  placeholder="0.00"
                />
              </div>
              {refundAmount && !isAmountValid && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {refundAmountNum <= 0
                    ? "Amount must be greater than zero"
                    : `Exceeds remaining refundable (AED ${remainingRefundable.toFixed(2)})`}
                </p>
              )}
              {/* Quick-fill buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setRefundAmount((remainingRefundable / 2).toFixed(2))
                  }
                  className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRefundAmount(remainingRefundable.toFixed(2))
                  }
                  className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  Full Refund
                </button>
              </div>
            </div>

            {/* Method */}
            <div>
              <Label className="text-sm font-medium">Refund Method</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REFUND_METHODS).map(([key, m]) => (
                    <SelectItem key={key} value={key}>
                      {m.icon} {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="refund-reason" className="text-sm font-medium">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter the reason for this refund (required)..."
                className={`mt-1.5 resize-none ${
                  reason.length > 0 && !isReasonValid
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }`}
                rows={3}
              />
              {reason.length > 0 && !isReasonValid && (
                <p className="text-xs text-red-500 mt-1">
                  Reason must be at least 3 characters
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={() => refundMutation.mutate()}
              disabled={!isFormValid || refundMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {refundMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Process Refund — AED{" "}
                  {isNaN(refundAmountNum) ? "0.00" : refundAmountNum.toFixed(2)}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* ── Refund History ──────────────────────────────────────────── */}
        {existingRefunds.length > 0 && (
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowHistory((p) => !p)}
              className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              <span>Refund History ({existingRefunds.length})</span>
              {showHistory ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2">
                {existingRefunds.map((r: any, i: number) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between p-3 bg-purple-50 rounded-lg border border-purple-100"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                          #{i + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(r.refundDate), "MMM dd, yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {r.reason}
                      </p>
                      <p className="text-xs text-gray-400">
                        via{" "}
                        {REFUND_METHODS[r.refundMethod as string]?.label ?? r.refundMethod}
                        {r.refundedBy && ` • by ${r.refundedBy}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-purple-700 shrink-0 ml-2">
                      −AED {parseFloat(r.refundAmount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
