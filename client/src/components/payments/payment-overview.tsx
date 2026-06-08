import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHODS } from "@/lib/constants";

export default function PaymentOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="lg:col-span-1 space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-32 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // monthlyIncome = gross player payments + advance repayments - refunds (true net collected)
  const totalCollected = parseFloat((stats as any)?.monthlyIncome || '0');
  const pendingPayments = parseFloat((stats as any)?.pendingPayments || '0');
  const overduePayments = parseFloat((stats as any)?.overduePayments || '0');

  const methodBreakdown: Record<string, number> = (stats as any)?.paymentMethodBreakdown || {};
  const methodTotal: number = (stats as any)?.paymentMethodTotal || 0;

  const getMethodPercent = (key: string): string => {
    if (methodTotal <= 0) return '0%';
    const pct = ((methodBreakdown[key] || 0) / methodTotal) * 100;
    return `${pct.toFixed(1)}%`;
  };

  return (
    <div className="lg:col-span-1 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Collected</span>
              <span className="text-lg font-bold text-green-600">
                AED {totalCollected.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Payments</span>
              <span className="text-lg font-bold text-academy-red">
                AED {pendingPayments.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Overdue</span>
              <span className="text-lg font-bold text-red-600">
                AED {overduePayments.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(PAYMENT_METHODS).map(([key, method]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{method.icon}</span>
                  <span className="text-sm">{method.label}</span>
                </div>
                <span className="text-sm font-medium">
                  {getMethodPercent(key)}
                </span>
              </div>
            ))}
            {methodTotal === 0 && (
              <p className="text-xs text-gray-400 text-center pt-1">No payments this month</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
