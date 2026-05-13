import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, MessageCircle, Users } from "lucide-react";
import { ACTIVITIES } from "@/lib/constants";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present", icon: CheckCircle, color: "text-green-600" },
  { value: "absent", label: "Absent", icon: XCircle, color: "text-red-600" },
  { value: "late", label: "Late", icon: Clock, color: "text-yellow-600" },
  { value: "excused", label: "Excused", icon: MessageCircle, color: "text-blue-600" },
];

const markPlayerAttendanceSchema = z.object({
  sessionDate: z.string().min(1, "Session date is required"),
  sessionTime: z.string().min(1, "Session time is required"),
  attendanceStatus: z.string().min(1, "Attendance status is required"),
  actualStartTime: z.string().optional(),
  actualEndTime: z.string().optional(),
  instructorName: z.string().optional(),
  notes: z.string().optional(),
});

type MarkPlayerAttendanceForm = z.infer<typeof markPlayerAttendanceSchema>;

interface MarkPlayerAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: any;
  onMarkAttendance: (data: MarkPlayerAttendanceForm) => void;
}

export default function MarkPlayerAttendanceModal({ 
  open, 
  onOpenChange, 
  player, 
  onMarkAttendance 
}: MarkPlayerAttendanceModalProps) {
  const form = useForm<MarkPlayerAttendanceForm>({
    resolver: zodResolver(markPlayerAttendanceSchema),
    defaultValues: {
      sessionDate: format(new Date(), 'yyyy-MM-dd'),
      sessionTime: format(new Date(), 'HH:mm'),
      attendanceStatus: "present",
      actualStartTime: format(new Date(), 'HH:mm'),
      actualEndTime: "",
      instructorName: "",
      notes: "",
    },
  });

  const onSubmit = (data: MarkPlayerAttendanceForm) => {
    onMarkAttendance(data);
    onOpenChange(false);
    form.reset();
  };

  if (!player) return null;

  const remainingSessions = player.totalSessionsAllowed - player.sessionsAttended;
  const activity = ACTIVITIES[player.activity as keyof typeof ACTIVITIES];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Mark Attendance - {player.fullName}
          </DialogTitle>
          <DialogDescription>
            Record session attendance for this player. This will automatically update their remaining sessions.
          </DialogDescription>
        </DialogHeader>

        {/* Player Info - Compact */}
        <div className="bg-gray-50 p-3 rounded-lg mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-xl">{activity?.emoji}</div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{player.fullName}</p>
                <p className="text-xs text-gray-600">{activity?.label}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3 text-academy-blue" />
                <span className="text-sm font-bold text-academy-blue">
                  {remainingSessions} / {player.totalSessionsAllowed}
                </span>
              </div>
              {remainingSessions <= 3 && (
                <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                  Low Sessions
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sessionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Session Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sessionTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Session Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} className="text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Attendance Status */}
            <FormField
              control={form.control}
              name="attendanceStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Attendance Status *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select attendance status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ATTENDANCE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center">
                              <Icon className={`w-4 h-4 mr-2 ${option.color}`} />
                              {option.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actual Times (Optional) - Compact */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="actualStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Actual Start</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} className="text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actualEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Actual End</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} className="text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Instructor */}
            <FormField
              control={form.control}
              name="instructorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Instructor Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter instructor name" {...field} className="text-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes - Smaller */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes about the session..."
                      className="min-h-[60px] text-sm"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warning for low sessions - Compact */}
            {remainingSessions <= 1 && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <p className="text-xs font-medium text-orange-800">
                    {remainingSessions === 0 
                      ? "No remaining sessions. Consider renewal." 
                      : "Only 1 session remaining. Consider renewal soon."}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                size="sm"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-academy-blue hover:bg-academy-blue-light text-white"
                size="sm"
              >
                Mark Attendance
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}