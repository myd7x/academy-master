import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, CreditCard, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function RecentActivities() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/dashboard/recent-activities"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent className="animate-pulse">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'registration':
        return { icon: Plus, bgColor: 'bg-green-500', color: 'text-white' };
      case 'payment':
        return { icon: CreditCard, bgColor: 'bg-academy-blue', color: 'text-white' };
      default:
        return { icon: AlertTriangle, bgColor: 'bg-yellow-500', color: 'text-white' };
    }
  };

  return (
    <Card className="glass border-none bg-white/60">
      <CardHeader className="border-b border-gray-100/50 pb-4">
        <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {(activities as any)?.slice(0, 5).map((activity: any, index: number) => {
            const { icon: Icon, bgColor } = getActivityIcon(activity.type);
            return (
              <div 
                key={index}
                className={`flex items-center space-x-4 p-4 rounded-xl transition-all hover:scale-[1.02] cursor-default border border-transparent hover:border-white/50 hover:shadow-md ${
                  activity.type === 'registration' ? 'bg-gradient-to-r from-green-50 to-green-100/50' :
                  activity.type === 'payment' ? 'bg-gradient-to-r from-blue-50 to-blue-100/50' : 'bg-gradient-to-r from-yellow-50 to-yellow-100/50'
                }`}
              >
                <div className={`w-10 h-10 ${bgColor} rounded-full flex items-center justify-center shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
