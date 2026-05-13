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

  const totalCollected = parseFloat((stats as any)?.monthlyRevenue || '0');
  const pendingPayments = parseFloat((stats as any)?.pendingPayments || '0');
  const overdue = 0; // TODO: Add overdue calculation

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
                ${totalCollected.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Payments</span>
              <span className="text-lg font-bold text-academy-red">
                ${pendingPayments.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Overdue</span>
              <span className="text-lg font-bold text-red-600">
                ${overdue.toLocaleString()}
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
                  {key === 'cash' ? '45%' : key === 'visa' ? '35%' : '20%'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
