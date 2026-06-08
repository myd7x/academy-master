import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, Legend,
} from "recharts";

const COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6',
];

function fmt(val: string | number) {
  return `AED ${parseFloat(String(val || '0')).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function monthLabel(month: string) {
  if (!month) return '';
  const [y, m] = month.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function DashboardCharts() {
  const { data: expenseTrends, isLoading: loadingTrends } = useQuery<Array<{ month: string; total: string }>>({
    queryKey: ["/api/dashboard/expense-trends"],
  });

  const { data: expenseCategories, isLoading: loadingCategories } = useQuery<Array<{ category: string; total: string }>>({
    queryKey: ["/api/dashboard/expense-categories"],
  });

  const { data: inventoryMovements, isLoading: loadingMovements } = useQuery<Array<{ month: string; stockIn: number; stockOut: number; adjustment: number }>>({
    queryKey: ["/api/dashboard/inventory-movements"],
  });

  const trendData = expenseTrends?.map(d => ({
    month: monthLabel(d.month),
    total: parseFloat(d.total),
  })) || [];

  const categoryData = expenseCategories?.map(d => ({
    name: d.category.charAt(0).toUpperCase() + d.category.slice(1),
    value: parseFloat(d.total),
  })) || [];

  const movementData = inventoryMovements?.map(d => ({
    month: monthLabel(d.month),
    'Stock In': d.stockIn,
    'Stock Out': d.stockOut,
    'Adjustment': d.adjustment,
  })) || [];

  const totalCategoryExpenses = categoryData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
        Financial Analytics
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Expense Trend */}
        <Card className="border-none bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-600">Monthly Expense Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <Skeleton className="h-[200px] w-full" />
            ) : trendData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No expense data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [fmt(value), 'Total']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    dot={{ fill: '#f43f5e', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#f43f5e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Expense Categories */}
        <Card className="border-none bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-600">Top Expense Categories (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <Skeleton className="h-[200px] w-full" />
            ) : categoryData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No expenses this month
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [fmt(value), '']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {categoryData.slice(0, 5).map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 truncate flex-1">{cat.name}</span>
                      <span className="font-semibold text-gray-800 tabular-nums">
                        {totalCategoryExpenses > 0 ? `${((cat.value / totalCategoryExpenses) * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Movement */}
        <Card className="border-none bg-white/80 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-600">Inventory Movement (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMovements ? (
              <Skeleton className="h-[200px] w-full" />
            ) : movementData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No inventory transactions yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={movementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Stock In" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Stock Out" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Adjustment" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
