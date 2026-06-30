import { toast } from "sonner";
import type { Task } from "@/lib/types";
import { apiErrorMessage } from "@/lib/api";
import { useDeleteTask } from "./hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTaskDialog({ task, open, onOpenChange }: Props) {
  const deleteTask = useDeleteTask();

  const onConfirm = async () => {
    if (!task) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success("Task deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete task"));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task?</AlertDialogTitle>
          <AlertDialogDescription>
            “{task?.title}” will be permanently removed. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={deleteTask.isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleteTask.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
