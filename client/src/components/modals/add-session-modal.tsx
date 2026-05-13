import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import PlayerSearchInput from "@/components/ui/player-search-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const addSessionSchema = z.object({
  playerId: z.string().min(1, "Player selection is required"),
  sessionDate: z.string().min(1, "Session date is required"),
  scheduledStartTime: z.string().min(1, "Start time is required"),
  scheduledEndTime: z.string().min(1, "End time is required"),
  instructorName: z.string().optional(),
  notes: z.string().optional(),
});

type AddSessionForm = z.infer<typeof addSessionSchema>;

interface AddSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Array<{ id: string; fullName: string; activity: string; }>;
}

export default function AddSessionModal({ open, onOpenChange, players }: AddSessionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddSessionForm>({
    resolver: zodResolver(addSessionSchema),
    defaultValues: {
      playerId: "",
      sessionDate: "",
      scheduledStartTime: "",
      scheduledEndTime: "",
      instructorName: "",
      notes: "",
    },
  });

  const selectedPlayer = players.find(p => p.id === form.watch("playerId"));

  const createSessionMutation = useMutation({
    mutationFn: async (data: AddSessionForm) => {
      const sessionDateTime = new Date(`${data.sessionDate}T${data.scheduledStartTime}`);
      const endDateTime = new Date(`${data.sessionDate}T${data.scheduledEndTime}`);

      return apiRequest("POST", "/api/sessions", {
        playerId: data.playerId,
        sessionDate: sessionDateTime,
        scheduledStartTime: sessionDateTime,
        scheduledEndTime: endDateTime,
        instructorName: data.instructorName || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Success",
        description: "Session scheduled successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddSessionForm) => {
    createSessionMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Schedule New Session
          </DialogTitle>
          <DialogDescription>
            Create a new session for a player with scheduled date and time.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Player Search */}
            <FormField
              control={form.control}
              name="playerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Search Player *</FormLabel>
                  <PlayerSearchInput
                    players={players || []}
                    onPlayerSelect={field.onChange}
                    selectedPlayerId={field.value}
                    placeholder="Search players by name, activity, or phone..."
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Session Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="sessionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduledStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduledEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Session Details */}
            <FormField
              control={form.control}
              name="instructorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructor Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter instructor name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Notes</FormLabel>
                  <FormControl>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Any special instructions or notes for this session..."
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                disabled={createSessionMutation.isPending}
              >
                {createSessionMutation.isPending ? "Scheduling..." : "Schedule Session"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}