import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { CheckCircle, XCircle, Clock, MessageCircle } from "lucide-react";

const markAttendanceSchema = z.object({
  attendanceStatus: z.string().min(1, "Attendance status is required"),
  actualStartTime: z.string().optional(),
  actualEndTime: z.string().optional(),
  notes: z.string().optional(),
});

type MarkAttendanceForm = z.infer<typeof markAttendanceSchema>;

interface MarkAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any;
  onMarkAttendance: (sessionId: string, playerId: string, status: string, notes?: string) => void;
}

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present", icon: CheckCircle, color: "text-green-600" },
  { value: "absent", label: "Absent", icon: XCircle, color: "text-red-600" },
  { value: "late", label: "Late", icon: Clock, color: "text-yellow-600" },
  { value: "excused", label: "Excused", icon: MessageCircle, color: "text-blue-600" },
];

export default function MarkAttendanceModal({ 
  open, 
  onOpenChange, 
  session, 
  onMarkAttendance 
}: MarkAttendanceModalProps) {
  const form = useForm<MarkAttendanceForm>({
    resolver: zodResolver(markAttendanceSchema),
    defaultValues: {
      attendanceStatus: session?.attendanceStatus || "",
      actualStartTime: session?.actualStartTime ? format(new Date(session.actualStartTime), 'HH:mm') : "",
      actualEndTime: session?.actualEndTime ? format(new Date(session.actualEndTime), 'HH:mm') : "",
      notes: session?.notes || "",
    },
  });

  const onSubmit = (data: MarkAttendanceForm) => {
    onMarkAttendance(session?.id, session?.playerId, data.attendanceStatus, data.notes);
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Mark Attendance - {session.playerName}
          </DialogTitle>
          <div className="text-sm text-gray-600">
            {format(new Date(session.sessionDate), 'EEEE, MMMM dd, yyyy')} • 
            {format(new Date(session.scheduledStartTime), 'HH:mm')} - 
            {format(new Date(session.scheduledEndTime), 'HH:mm')}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Attendance Status */}
            <FormField
              control={form.control}
              name="attendanceStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Attendance Status *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
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

            {/* Actual Times */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="actualStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
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
                    <FormLabel>Actual End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Session Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Notes</FormLabel>
                  <FormControl>
                    <textarea 
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Add any notes about this session - player performance, behavior, areas for improvement, etc."
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Session Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Session Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Scheduled Duration:</span>
                  <div className="font-medium">
                    {Math.round((new Date(session.scheduledEndTime).getTime() - new Date(session.scheduledStartTime).getTime()) / (1000 * 60))} minutes
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Session Cost:</span>
                  <div className="font-medium text-green-600">
                    ${session.sessionCost || '0.00'}
                  </div>
                </div>
                {session.instructorName && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Instructor:</span>
                    <div className="font-medium">{session.instructorName}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-academy-blue hover:bg-academy-blue-light text-white"
              >
                Save Attendance
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}