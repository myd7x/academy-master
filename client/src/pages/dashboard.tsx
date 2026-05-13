import { Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StatsCards from "@/components/dashboard/stats-cards";
import ActivityOverview from "@/components/dashboard/activity-overview";
import RecentActivities from "@/components/dashboard/recent-activities";
import UpcomingRenewals from "@/components/dashboard/upcoming-renewals";
import RenewalNotifications from "@/components/dashboard/renewal-notifications";
import AddPlayerModal from "@/components/modals/add-player-modal";

export default function Dashboard() {
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  
  // Fetch renewal notifications for the bell count  
  const { data: notifications } = useQuery({
    queryKey: ["/api/dashboard/renewal-notifications"],
  });
  
  const notificationCount = (notifications as any[])?.length || 0;

  return (
    <>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-5 sticky top-0 z-10 transition-all">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-academy-blue to-purple-600 truncate">Dashboard</h2>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Button 
              onClick={() => setShowAddPlayer(true)}
              className="bg-gradient-to-r from-academy-blue to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all rounded-full px-3 sm:px-6 text-sm"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Player</span>
            </Button>
            <button 
              onClick={() => {
                const element = document.getElementById('renewal-notifications');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="h-6 w-6 text-gray-400" />
              {notificationCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 text-xs min-w-[20px] h-5 flex items-center justify-center p-1"
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Badge>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto gradient-bg p-4 sm:p-8">
        <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-7xl mx-auto">
          <StatsCards />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <ActivityOverview />
            <RecentActivities />
          </div>
          
          {/* Renewal Notifications */}
          {notificationCount > 0 && (
            <div id="renewal-notifications">
              <RenewalNotifications />
            </div>
          )}
          
          <UpcomingRenewals />
        </div>
      </main>

      <AddPlayerModal 
        open={showAddPlayer}
        onOpenChange={setShowAddPlayer}
      />
    </>
  );
}

