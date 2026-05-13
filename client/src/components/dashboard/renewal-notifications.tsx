import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Clock, AlertTriangle, Calendar } from "lucide-react";
import { ACTIVITIES } from "@/lib/constants";
import { format } from "date-fns";
import { useState } from "react";
import EditPlayerModal from "@/components/modals/edit-player-modal";

export default function RenewalNotifications() {
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["/api/dashboard/renewal-notifications"],
  });

  const { data: playersData } = useQuery({
    queryKey: ["/api/players"],
  });

  const players = playersData as any[] || [];

  const handleRenewPlayer = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      setSelectedPlayer(player);
      setShowEditModal(true);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Renewal Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="animate-pulse">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const notificationsList = notifications as any[] || [];

  if (notificationsList.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Renewal Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Bell className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>No renewal notifications at this time</p>
            <p className="text-sm">All players are up to date!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Renewal Notifications
            </div>
            <Badge variant="destructive" className="ml-2">
              {notificationsList.length}
            </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notificationsList.map((notification: any) => {
            const activity = ACTIVITIES[notification.activity as keyof typeof ACTIVITIES];
            const isUrgent = notification.reason === 'renewal_due' && notification.daysUntilRenewal <= 1;
            
            return (
              <div 
                key={notification.playerId}
                className={`p-4 rounded-lg border-l-4 ${
                  isUrgent 
                    ? 'border-red-500 bg-red-50' 
                    : notification.reason === 'renewal_due' 
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {notification.reason === 'renewal_due' ? (
                        <Calendar className="h-4 w-4 text-orange-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="font-medium text-gray-900">
                        {notification.playerName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {activity ? `${activity.emoji} ${activity.label}` : notification.activity}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      {notification.reason === 'renewal_due' ? (
                        <>
                          <p className="font-medium text-orange-700">
                            {notification.daysUntilRenewal <= 0 
                              ? '⚠️ Subscription expired!' 
                              : `Renewal due in ${notification.daysUntilRenewal} day${notification.daysUntilRenewal === 1 ? '' : 's'}`
                            }
                          </p>
                          <p>Renewal Date: {format(new Date(notification.renewalDate), 'MMM dd, yyyy')}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-blue-700">
                            {notification.sessionsLeft <= 3 
                              ? `⚠️ Only ${notification.sessionsLeft} session${notification.sessionsLeft === 1 ? '' : 's'} remaining!`
                              : `${notification.sessionsLeft} sessions remaining`
                            }
                          </p>
                          <p>Renewal Date: {format(new Date(notification.renewalDate), 'MMM dd, yyyy')}</p>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <Button 
                      size="sm" 
                      variant={isUrgent ? "destructive" : "default"}
                      className="text-xs"
                      onClick={() => handleRenewPlayer(notification.playerId)}
                    >
                      {notification.reason === 'renewal_due' ? 'Renew Now' : 'Renew Subscription'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>

      {selectedPlayer && (
        <EditPlayerModal
          player={selectedPlayer}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          defaultTab="renew"
        />
      )}
    </>
  );
}