import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACTIVITIES, SUBSCRIPTION_STATUS_COLORS, PAYMENT_STATUS_COLORS } from "@/lib/constants";
import { format } from "date-fns";
import { User, Calendar, Phone, Mail, Activity, DollarSign, Printer, History, RotateCcw } from "lucide-react";
import DocumentManager from "@/components/ui/document-manager";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import RefundPaymentModal from "@/components/modals/refund-payment-modal";

// Payment Section Component
function PaymentSection({ playerId }: { playerId: string | null }) {
  const [refundModalOpen, setRefundModalOpen] = React.useState(false);
  const [selectedPayment, setSelectedPayment] = React.useState<any>(null);

  const { data: currentPayments, refetch: refetchPayments } = useQuery({
    queryKey: ["/api/payments", "player", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const response = await fetch(`/api/payments?playerId=${playerId}`);
      if (!response.ok) throw new Error('Failed to fetch payments');
      return response.json();
    },
    enabled: !!playerId,
  });

  const { data: paymentHistory } = useQuery({
    queryKey: ["/api/payments/history", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const response = await fetch(`/api/payments/history/${playerId}`);
      if (!response.ok) throw new Error('Failed to fetch payment history');
      return response.json();
    },
    enabled: !!playerId,
  });

  // Fetch all refunds for this player so we can match them to payments
  const { data: playerRefunds, refetch: refetchRefunds } = useQuery({
    queryKey: ["/api/players", playerId, "refunds"],
    queryFn: async () => {
      if (!playerId) return [];
      const response = await fetch(`/api/players/${playerId}/refunds`);
      if (!response.ok) throw new Error('Failed to fetch refunds');
      return response.json();
    },
    enabled: !!playerId,
  });

  const refundsByPayment = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    if (Array.isArray(playerRefunds)) {
      for (const r of playerRefunds) {
        if (!map[r.paymentId]) map[r.paymentId] = [];
        map[r.paymentId].push(r);
      }
    }
    return map;
  }, [playerRefunds]);

  const handleRefundClick = (payment: any) => {
    setSelectedPayment(payment);
    setRefundModalOpen(true);
  };

  const canRefund = (p: any) =>
    p.paymentStatus !== 'cancelled' && p.paymentStatus !== 'refunded';

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-3">Payments</h3>
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="current">Current Period</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-3">
          {currentPayments && currentPayments.length > 0 ? (
            currentPayments.map((payment: any) => {
              const refunds = refundsByPayment[payment.id] ?? [];
              const totalRefunded = refunds.reduce((s: number, r: any) => s + parseFloat(r.refundAmount), 0);
              const isRefunded = payment.paymentStatus === 'refunded';
              const isPartial = payment.paymentStatus === 'partially_refunded';

              return (
                <div key={payment.id} className="p-3 bg-gray-50 rounded-lg border">
                  {/* Payment row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${
                          isRefunded ? 'line-through text-gray-400' : 'text-gray-900'
                        }`}>
                          AED {parseFloat(payment.amountPaid).toFixed(2)}
                        </span>
                        {isRefunded && (
                          <Badge className="bg-purple-100 text-purple-800 text-xs">↩ Refunded</Badge>
                        )}
                        {isPartial && (
                          <Badge className="bg-indigo-100 text-indigo-800 text-xs">↩ Partial Refund</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(payment.paymentDate), 'MMM dd, yyyy')} · {payment.paymentMethod}
                      </p>
                      {totalRefunded > 0 && (
                        <p className="text-xs text-purple-600 mt-0.5">
                          Refunded: AED {totalRefunded.toFixed(2)}
                          {!isRefunded && ` · Remaining: AED ${(parseFloat(payment.amountPaid) - totalRefunded).toFixed(2)}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <Badge variant="outline" className="text-xs">{payment.paymentMethod}</Badge>
                      {canRefund(payment) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                          onClick={() => handleRefundClick(payment)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Refund
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Refund history for this payment */}
                  {refunds.length > 0 && (
                    <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-purple-200">
                      {refunds.map((r: any, i: number) => (
                        <div key={r.id} className="flex items-start justify-between text-xs">
                          <div>
                            <span className="text-purple-600 font-medium">↩ Refund #{i + 1}</span>
                            <span className="text-gray-400 ml-1">
                              {format(new Date(r.refundDate), 'MMM dd, yyyy')}
                            </span>
                            <p className="text-gray-500 truncate max-w-[200px]">{r.reason}</p>
                          </div>
                          <span className="text-purple-700 font-bold shrink-0 ml-2">
                            −AED {parseFloat(r.refundAmount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No current payments recorded</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {paymentHistory && paymentHistory.length > 0 ? (
            paymentHistory.map((payment: any) => (
              <div key={payment.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <div>
                  <span className="text-sm font-medium text-gray-900">AED {parseFloat(payment.amountPaid).toFixed(2)}</span>
                  <p className="text-xs text-gray-500">
                    {format(new Date(payment.paymentDate), 'MMM dd, yyyy')}
                    <span className="ml-2 text-blue-600">
                      ({format(new Date(payment.subscriptionPeriodStart), 'MMM dd')} - {format(new Date(payment.subscriptionPeriodEnd), 'MMM dd, yyyy')})
                    </span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{payment.paymentMethod}</Badge>
                  <History className="h-3 w-3 text-blue-500" />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No payment history found</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Refund Modal */}
      <RefundPaymentModal
        open={refundModalOpen}
        onOpenChange={(open) => {
          setRefundModalOpen(open);
          if (!open) {
            refetchPayments();
            refetchRefunds();
          }
        }}
        payment={selectedPayment}
      />
    </div>
  );
}

interface ViewPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string | null;
}

export default function ViewPlayerModal({ open, onOpenChange, playerId }: ViewPlayerModalProps) {
  const { data: player, isLoading } = useQuery({
    queryKey: ["/api/players", playerId],
    enabled: !!playerId && open,
  });

  if (!playerId || isLoading || !player) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const playerData = player as any;
  const activity = playerData?.activity ? ACTIVITIES[playerData.activity as keyof typeof ACTIVITIES] : null;
  const age = playerData?.dateOfBirth ? new Date().getFullYear() - new Date(playerData.dateOfBirth).getFullYear() : 0;

  const handlePrint = () => {
    const printContent = document.getElementById('player-details-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Player Details - ${playerData.fullName}</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  line-height: 1.6; 
                  color: #333; 
                  max-width: 800px; 
                  margin: 0 auto; 
                  padding: 20px; 
                }
                .print-header {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 16px;
                  border-bottom: 3px solid #2563EB;
                  padding-bottom: 18px;
                  margin-bottom: 28px;
                }
                .print-header img {
                  width: 72px;
                  height: 72px;
                  object-fit: contain;
                  border-radius: 8px;
                }
                .print-header-text h1 {
                  color: #2563EB;
                  font-size: 22px;
                  font-weight: bold;
                  margin: 0;
                }
                .print-header-text p {
                  color: #DC2626;
                  font-size: 13px;
                  margin: 2px 0 0;
                }
                .print-header-text small {
                  color: #6B7280;
                  font-size: 11px;
                }
                .section { 
                  margin-bottom: 25px; 
                  border: 1px solid #E5E7EB; 
                  padding: 15px; 
                  border-radius: 8px; 
                }
                .section-title { 
                  font-size: 18px; 
                  font-weight: bold; 
                  color: #1F2937; 
                  border-bottom: 1px solid #E5E7EB; 
                  padding-bottom: 8px; 
                  margin-bottom: 15px; 
                }
                .info-item { margin-bottom: 8px; }
                .label { font-weight: bold; color: #374151; }
                .value { color: #6B7280; }
                .badge { 
                  background: #F3F4F6; 
                  padding: 4px 8px; 
                  border-radius: 4px; 
                  font-size: 12px; 
                  display: inline-block; 
                }
                .payment-summary { 
                  background: #F9FAFB; 
                  padding: 15px; 
                  border-radius: 6px; 
                  margin-top: 10px; 
                }
                @media print {
                  body { margin: 0; }
                  .no-print { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="print-header">
                <img src="${LOGO_BASE64}" alt="E1 Sport Champions Academy" />
                <div class="print-header-text">
                  <h1>E1 Sport</h1>
                  <p>Champions Academy</p>
                  <small>Player Profile Report &mdash; ${format(new Date(), 'MMMM dd, yyyy')}</small>
                </div>
              </div>
              ${printContent.outerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center justify-between">
            <div className="flex items-center">
              <User className="mr-2 h-6 w-6" />
              Player Details - {playerData.fullName}
            </div>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="no-print"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogTitle>
          <DialogDescription>
            Complete profile and payment information for the selected player.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <div id="player-details-content">
              {/* Print Header - shown only when printing */}
              <div className="header hidden print:block text-center border-b-2 border-blue-600 pb-5 mb-8">
                <div className="flex items-center justify-center gap-4">
                  <img src="/e1-sport-logo.jpg" alt="E1 Sport" className="w-16 h-16 object-contain rounded" />
                  <div>
                    <div className="academy-logo text-blue-600 text-2xl font-bold">E1 Sport</div>
                    <div className="academy-subtitle text-red-600 text-sm mt-1">Champions Academy</div>
                    <div className="text-lg font-semibold mt-3">Player Profile Report</div>
                    <div className="text-sm text-gray-600 mt-1">Generated on {format(new Date(), 'MMMM dd, yyyy')}</div>
                  </div>
                </div>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Personal Information</h3>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{playerData.fullName}</p>
                  <p className="text-sm text-gray-500">Full Name</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="h-5 w-5 flex items-center justify-center bg-gray-100 rounded text-xs font-mono text-gray-600">
                  ID
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 font-mono">{playerData.id}</p>
                  <p className="text-sm text-gray-500">Player ID</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(playerData.dateOfBirth), 'MMMM dd, yyyy')} (Age: {age})
                  </p>
                  <p className="text-sm text-gray-500">Date of Birth</p>
                </div>
              </div>

              {playerData.phoneNumber && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{playerData.phoneNumber}</p>
                    <p className="text-sm text-gray-500">Phone Number</p>
                  </div>
                </div>
              )}

              {playerData.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{playerData.email}</p>
                    <p className="text-sm text-gray-500">Email Address</p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <Activity className="h-5 w-5 text-gray-400" />
                <div>
                  <Badge className="bg-blue-100 text-blue-800">
                    {activity ? `${activity.emoji} ${activity.label}` : playerData?.activity || 'Unknown'}
                  </Badge>
                  <p className="text-sm text-gray-500 mt-1">Activity</p>
                </div>
              </div>

              {/* Medical Information */}
              {(playerData.medicalConditions || playerData.allergies || playerData.emergencyContact) && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="text-sm font-medium text-red-900 mb-2">Medical Information</h4>
                  <div className="space-y-2">
                    {playerData.medicalConditions && (
                      <div>
                        <p className="text-xs text-red-700 font-medium">Medical Conditions:</p>
                        <p className="text-xs text-red-800">{playerData.medicalConditions}</p>
                      </div>
                    )}
                    {playerData.allergies && (
                      <div>
                        <p className="text-xs text-red-700 font-medium">Allergies:</p>
                        <p className="text-xs text-red-800">{playerData.allergies}</p>
                      </div>
                    )}
                    {playerData.emergencyContact && (
                      <div>
                        <p className="text-xs text-red-700 font-medium">Emergency Contact:</p>
                        <p className="text-xs text-red-800">{playerData.emergencyContact}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Subscription Details</h3>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Subscription Status</p>
                <Badge className={`mt-1 ${SUBSCRIPTION_STATUS_COLORS[playerData.subscriptionStatus as keyof typeof SUBSCRIPTION_STATUS_COLORS]}`}>
                  {playerData.subscriptionStatus === 'active' ? 'Active' : 
                   playerData.subscriptionStatus === 'expired' ? 'Expired' :
                   playerData.subscriptionStatus === 'renewal_due' ? 'Renewal Due' :
                   playerData.subscriptionStatus === 'paused' ? 'Paused' :
                   playerData.subscriptionStatus === 'cancelled' ? 'Cancelled' :
                   playerData.subscriptionStatus?.replace('_', ' ')}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">Subscription Period</p>
                <p className="text-sm text-gray-600">
                  {format(new Date(playerData.subscriptionDate), 'MMM dd, yyyy')} - {format(new Date(playerData.renewalDate), 'MMM dd, yyyy')}
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">AED {playerData.monthlySubscriptionFee}</p>
                  <p className="text-sm text-gray-500">Monthly Fee</p>
                </div>
              </div>

              {/* Payment Tracking */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">Payment Status</p>
                {(() => {
                  const totalPaid = playerData.payments?.reduce((sum: number, payment: any) => 
                    sum + parseFloat(payment.amountPaid || "0"), 0) || 0;
                  const totalDue = parseFloat(playerData.monthlySubscriptionFee || "0");
                  const remainingBalance = Math.max(0, totalDue - totalPaid);
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Due:</span>
                        <span className="font-medium">AED {totalDue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Amount Paid:</span>
                        <span className="font-medium text-green-600">AED {totalPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-gray-600">Remaining Balance:</span>
                        <span className={`font-medium ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          AED {remainingBalance.toFixed(2)}
                        </span>
                      </div>
                      {/* Payment Progress Bar */}
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              totalPaid >= totalDue ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ 
                              width: `${Math.min(100, totalDue > 0 ? (totalPaid / totalDue) * 100 : 0)}%` 
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          {totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0}% paid
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">Sessions</p>
                <p className="text-sm text-gray-600">
                  {playerData.sessionsAttended}/{playerData.totalSessionsAllowed} attended
                  ({Math.max(0, playerData.totalSessionsAllowed - playerData.sessionsAttended)} remaining)
                </p>
              </div>

              {playerData.discountPercentage !== "0" && (
                <div>
                  <p className="text-sm font-medium text-gray-900">Discount</p>
                  <p className="text-sm text-gray-600">{playerData.discountPercentage}%</p>
                </div>
              )}
            </div>
          </div>
        </div>

              {/* Payment Status Summary - Simplified for Profile Tab */}
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-3">Payment Summary</h3>
                {(() => {
                  const totalPaid = playerData.payments?.reduce((sum: number, payment: any) => 
                    sum + parseFloat(payment.amountPaid || 0), 0) || 0;
                  const subscriptionFee = parseFloat(playerData.monthlySubscriptionFee || 0);
                  const remainingBalance = subscriptionFee - totalPaid;

                  return (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Total Paid</p>
                          <p className="text-lg font-semibold text-green-600">AED {totalPaid.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Subscription Fee</p>
                          <p className="text-lg font-semibold text-gray-900">AED {subscriptionFee.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Balance</p>
                          <p className={`text-lg font-semibold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            AED {remainingBalance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Special Notes */}
              {playerData.specialNotes && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-3">Special Notes</h3>
                  <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded">{playerData.specialNotes}</p>
                </div>
              )}
            </div> {/* End of print content */}
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Player Documents</h3>
                <p className="text-sm text-gray-600 mb-6">
                  View and manage player documents including ID documents, medical forms, and other files.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DocumentManager
                  playerId={playerData.id}
                  documents={playerData.documents || []}
                  documentType="id"
                  documentLabel="ID Document"
                  accept=".png,.jpg,.jpeg,.pdf"
                  maxSize={10 * 1024 * 1024}
                  readOnly={true}
                />

                <DocumentManager
                  playerId={playerData.id}
                  documents={playerData.documents || []}
                  documentType="medical_form"
                  documentLabel="Medical Form"
                  accept=".png,.jpg,.jpeg,.pdf"
                  maxSize={10 * 1024 * 1024}
                  readOnly={true}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment History</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Complete payment records for this player, including current and archived payments.
                </p>
              </div>
              
              <PaymentSection playerId={playerId} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 no-print">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}