import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Calendar, Filter, RotateCcw } from "lucide-react";
import { PAYMENT_METHODS, PAYMENT_STATUS_COLORS } from "@/lib/constants";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import ReceiptModal from "@/components/modals/receipt-modal";
import ViewPlayerModal from "@/components/modals/view-player-modal";
import RefundPaymentModal from "@/components/modals/refund-payment-modal";

export default function PaymentRecords() {
  const [selectedPlayer, setSelectedPlayer] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [viewPlayerModalOpen, setViewPlayerModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedPlayerData, setSelectedPlayerData] = useState<any>(null);
  const [selectedPlayerPayments, setSelectedPlayerPayments] = useState<any[]>([]);
  
  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ["/api/payments", selectedPlayer, selectedMonth],
    queryFn: async () => {
      let url = `/api/payments?`;
      if (selectedPlayer !== "all") {
        url += `playerId=${selectedPlayer}&`;
      }
      if (selectedMonth) {
        const startDate = startOfMonth(parseISO(selectedMonth + '-01')).toISOString();
        const endDate = endOfMonth(parseISO(selectedMonth + '-01')).toISOString();
        url += `startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch payments');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const { data: players } = useQuery({
    queryKey: ["/api/players"],
  });

  const handleReceiptClick = async (payment: any) => {
    try {
      const response = await fetch(`/api/players/${payment.playerId}`);
      if (response.ok) {
        const playerData = await response.json();
        const paymentsResponse = await fetch(`/api/payments?playerId=${payment.playerId}`);
        const paymentsData = paymentsResponse.ok ? await paymentsResponse.json() : [];

        setSelectedPayment(payment);
        setSelectedPlayerData(playerData);
        setSelectedPlayerPayments(paymentsData);
        setReceiptModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    }
  };

  const handleRefundClick = (payment: any) => {
    setSelectedPayment(payment);
    setRefundModalOpen(true);
  };

  // Force refetch when component mounts
  React.useEffect(() => {
    refetch();
  }, [refetch]);

  // Generate months for the last 12 months
  const getMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy')
      });
    }
    return months;
  };

  const canRefund = (payment: any) =>
    payment.paymentStatus !== 'cancelled' && payment.paymentStatus !== 'refunded';

  const formatStatus = (status: string) =>
    status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  if (isLoading) {
    return (
      <div className="lg:col-span-2">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-64 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Payment Records</span>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by player" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Players</SelectItem>
                      {(players as any)?.map((player: any) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {getMonthOptions().map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(payments as any)?.slice(0, 20).map((payment: any) => {
                    const method = PAYMENT_METHODS[payment.paymentMethod as keyof typeof PAYMENT_METHODS];
                    const statusColor = PAYMENT_STATUS_COLORS[payment.paymentStatus] ?? "bg-gray-100 text-gray-800";
                    const isRefundable = canRefund(payment);
                    const isRefunded = payment.paymentStatus === 'refunded';
                    const isPartiallyRefunded = payment.paymentStatus === 'partially_refunded';

                    return (
                      <tr key={payment.id} className={`hover:bg-gray-50 transition-colors ${isRefunded ? 'opacity-75' : ''}`}>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            className="text-sm font-medium text-academy-blue hover:text-academy-blue-light hover:underline focus:outline-none text-left"
                            onClick={() => {
                              setSelectedPlayer(payment.playerId);
                              setViewPlayerModalOpen(true);
                            }}
                          >
                            {payment.playerName || payment.fullName || 'Unknown Player'}
                          </button>
                          <div className="text-sm text-gray-500">{payment.description || 'Subscription payment'}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className={`text-sm font-semibold ${isRefunded ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            AED {parseFloat(payment.amountPaid).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Bal: AED {parseFloat(payment.remainingBalance).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-base">{method?.icon}</span>
                            <span className="text-sm text-gray-700">{method?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {format(new Date(payment.paymentDate), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                            {isRefunded && <span className="mr-1">↩</span>}
                            {isPartiallyRefunded && <span className="mr-1">↩</span>}
                            {formatStatus(payment.paymentStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="link"
                              className="text-academy-blue hover:text-academy-blue-light p-0 h-auto"
                              onClick={() => handleReceiptClick(payment)}
                            >
                              <Receipt className="h-3.5 w-3.5 mr-1" />
                              Receipt
                            </Button>

                            {isRefundable && (
                              <Button
                                variant="link"
                                className="text-purple-600 hover:text-purple-800 p-0 h-auto ml-2"
                                onClick={() => handleRefundClick(payment)}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Refund
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!payments || (payments as any).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No payments found for the selected criteria</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        player={selectedPlayerData}
        payment={selectedPayment}
        allPayments={selectedPlayerPayments}
      />

      {/* View Player Modal */}
      <ViewPlayerModal
        open={viewPlayerModalOpen}
        onOpenChange={setViewPlayerModalOpen}
        playerId={selectedPlayer === "all" ? (selectedPayment?.playerId || null) : selectedPlayer}
      />

      {/* Refund Modal */}
      <RefundPaymentModal
        open={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        payment={selectedPayment}
      />
    </>
  );
}