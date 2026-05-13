import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  Plus,
  Edit,
  Timer,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ACTIVITIES } from "@/lib/constants";
import { apiRequest } from "@/lib/queryClient";
import AddSessionModal from "@/components/modals/add-session-modal";
import MarkAttendanceModal from "@/components/modals/mark-attendance-modal";

const ATTENDANCE_STATUS_COLORS = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800", 
  late: "bg-yellow-100 text-yellow-800",
  excused: "bg-blue-100 text-blue-800",
} as const;

const SESSION_STATUS_COLORS = {
  scheduled: "bg-blue-100 text-blue-800",
  attended: "bg-green-100 text-green-800",
  missed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
} as const;

export default function SessionManagement() {
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["/api/sessions"],
  });

  const { data: players } = useQuery({
    queryKey: ["/api/players"],
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ sessionId, playerId, status, notes }: {
      sessionId: string;
      playerId: string;
      status: string;
      notes?: string;
    }) => {
      return apiRequest(`/api/sessions/${sessionId}/attendance`, "POST", { playerId, status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Success",
        description: "Attendance updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredSessions = (sessions as any)?.filter((session: any) => {
    const matchesActivity = !selectedActivity || selectedActivity === 'all' || session.activity === selectedActivity;
    const matchesDate = !selectedDate || format(new Date(session.sessionDate), 'yyyy-MM-dd') === selectedDate;
    const matchesSearch = !searchTerm || session.playerName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesActivity && matchesDate && matchesSearch;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredSessions?.filter((s: any) => 
                    format(new Date(s.sessionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ).length || 0}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-academy-blue" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Present Today</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredSessions?.filter((s: any) => 
                    s.attendanceStatus === 'present' && 
                    format(new Date(s.sessionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ).length || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Absent Today</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredSessions?.filter((s: any) => 
                    s.attendanceStatus === 'absent' && 
                    format(new Date(s.sessionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ).length || 0}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Attendance</p>
                <p className="text-2xl font-bold text-academy-blue">
                  {Math.round(
                    (filteredSessions?.filter((s: any) => s.attendanceStatus === 'present').length / 
                     Math.max(filteredSessions?.length, 1)) * 100
                  ) || 0}%
                </p>
              </div>
              <Users className="h-8 w-8 text-academy-blue" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <CardTitle>Session Management</CardTitle>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-academy-blue hover:bg-academy-blue-light text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={selectedActivity} onValueChange={setSelectedActivity}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {Object.entries(ACTIVITIES).map(([key, activity]) => (
                  <SelectItem key={key} value={key}>
                    {activity.emoji} {activity.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>

          {/* Sessions List */}
          <div className="space-y-4">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No sessions match your current filters.
                </p>
              </div>
            ) : (
              filteredSessions.map((session: any) => {
                const activity = ACTIVITIES[session.activity as keyof typeof ACTIVITIES];
                return (
                  <Card key={session.id} className="border-l-4 border-l-academy-blue">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-academy-blue bg-opacity-10 rounded-lg flex items-center justify-center">
                              <span className="text-2xl">{activity?.emoji}</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-lg font-medium text-gray-900">
                                {session.playerName}
                              </h3>
                              <Badge className={ATTENDANCE_STATUS_COLORS[session.attendanceStatus as keyof typeof ATTENDANCE_STATUS_COLORS]}>
                                {session.attendanceStatus}
                              </Badge>
                              <Badge className={SESSION_STATUS_COLORS[session.sessionStatus as keyof typeof SESSION_STATUS_COLORS]}>
                                {session.sessionStatus}
                              </Badge>
                            </div>
                            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {format(new Date(session.sessionDate), 'MMM dd, yyyy')}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {format(new Date(session.scheduledStartTime), 'HH:mm')} - {format(new Date(session.scheduledEndTime), 'HH:mm')}
                              </div>
                              {session.instructorName && (
                                <div className="flex items-center">
                                  <Users className="w-4 h-4 mr-1" />
                                  {session.instructorName}
                                </div>
                              )}
                            </div>
                            {session.notes && (
                              <p className="mt-2 text-sm text-gray-600">
                                {session.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSession(session);
                              setShowAttendanceModal(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Mark Attendance
                          </Button>
                          {session.actualStartTime && session.actualEndTime && (
                            <div className="text-sm text-green-600 font-medium">
                              <Timer className="w-4 h-4 inline mr-1" />
                              Duration: {Math.round((new Date(session.actualEndTime).getTime() - new Date(session.actualStartTime).getTime()) / (1000 * 60))} min
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <AddSessionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        players={players as any || []}
      />

      <MarkAttendanceModal
        open={showAttendanceModal}
        onOpenChange={setShowAttendanceModal}
        session={selectedSession}
        onMarkAttendance={(sessionId, playerId, status, notes) => {
          markAttendanceMutation.mutate({ sessionId, playerId, status, notes });
          setShowAttendanceModal(false);
        }}
      />
    </div>
  );
}