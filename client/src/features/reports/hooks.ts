import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CategoryReport, CompletionTrend, ReportSummary } from "@/lib/types";

export function useReportSummary() {
  return useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => api.get<ReportSummary>("/reports/summary").then((r) => r.data),
  });
}

export function useReportByCategory() {
  return useQuery({
    queryKey: ["reports", "by-category"],
    queryFn: () => api.get<CategoryReport>("/reports/by-category").then((r) => r.data),
  });
}

export function useCompletionTrend(days: number) {
  return useQuery({
    queryKey: ["reports", "trend", days],
    queryFn: () =>
      api
        .get<CompletionTrend>("/reports/completion-trend", { params: { days } })
        .then((r) => r.data),
  });
}

/** ADMIN-only: refresh the materialized views, then refetch all report data. */
export function useRefreshReports() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ refreshed: string[]; refreshedAt: string }>("/reports/refresh").then(
        (r) => r.data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}
