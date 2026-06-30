import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { CheckCircle2, ListTodo, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { apiErrorMessage } from "@/lib/api";
import { STATUS_LABEL, PRIORITY_LABEL } from "@/features/tasks/constants";
import {
  useCompletionTrend,
  useReportByCategory,
  useReportSummary,
  useRefreshReports,
} from "./hooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TaskPriority, TaskStatus } from "@/lib/types";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const trendConfig = {
  count: { label: "Completed", color: "var(--chart-1)" },
} satisfies ChartConfig;

const barConfig = { value: { label: "Tasks" } } satisfies ChartConfig;

function StatCard({
  label,
  value,
  hint,
  icon,
  alert,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
        <span className={alert ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-semibold ${alert ? "text-destructive" : ""}`}>
          {value}
        </div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);

  const summaryQ = useReportSummary();
  const categoryQ = useReportByCategory();
  const trendQ = useCompletionTrend(days);
  const refresh = useRefreshReports();

  const isAdmin = user?.role === "ADMIN";

  const onRefresh = async () => {
    try {
      await refresh.mutateAsync();
      toast.success("Reports refreshed");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not refresh reports"));
    }
  };

  const summary = summaryQ.data?.summary;
  const completionPct = summary ? Math.round(summary.completionRate * 100) : 0;

  const statusData = (Object.keys(STATUS_LABEL) as TaskStatus[]).map((s, i) => ({
    name: STATUS_LABEL[s],
    value: summaryQ.data?.byStatus[s] ?? 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const priorityData = (Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p, i) => ({
    name: PRIORITY_LABEL[p],
    value: summaryQ.data?.byPriority[p] ?? 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const categoryData =
    categoryQ.data?.categories.map((c, i) => ({
      name: c.categoryName ?? "Uncategorized",
      value: c.count,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })) ?? [];
  const trendData = trendQ.data?.points ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Organization-wide analytics" : "Your task analytics"} · as of last
            refresh
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={onRefresh} disabled={refresh.isPending}>
            <RefreshCw className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`} />
            {refresh.isPending ? "Refreshing…" : "Refresh data"}
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryQ.isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px]" />)
        ) : (
          <>
            <StatCard
              label="Total tasks"
              value={summary.total}
              icon={<ListTodo className="size-4" />}
            />
            <StatCard
              label="Completed"
              value={summary.completed}
              hint={`${completionPct}% completion rate`}
              icon={<CheckCircle2 className="size-4" />}
            />
            <StatCard label="Open" value={summary.open} icon={<ListTodo className="size-4" />} />
            <StatCard
              label="Overdue"
              value={summary.overdue}
              icon={<TriangleAlert className="size-4" />}
              alert={summary.overdue > 0}
            />
          </>
        )}
      </div>

      {/* Completion trend */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Completion trend</CardTitle>
            <CardDescription>Tasks completed per day</CardDescription>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {trendQ.isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : trendData.length === 0 ? (
            <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
              No completed tasks in this period.
            </div>
          ) : (
            <ChartContainer config={trendConfig} className="h-[260px] w-full">
              <AreaChart data={trendData} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
                />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(d) => format(parseISO(String(d)), "MMM d, yyyy")}
                    />
                  }
                />
                <Area
                  dataKey="count"
                  type="natural"
                  fill="var(--color-count)"
                  fillOpacity={0.2}
                  stroke="var(--color-count)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Status + priority breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
            <CardDescription>Task distribution across statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ChartContainer config={barConfig} className="h-[240px] w-full">
                <BarChart data={statusData} margin={{ top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={6}>
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By priority</CardTitle>
            <CardDescription>Task distribution across priorities</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ChartContainer config={barConfig} className="h-[240px] w-full">
                <BarChart data={priorityData} margin={{ top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={6}>
                    {priorityData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By category */}
      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
          <CardDescription>Tasks grouped by category</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryQ.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : categoryData.length === 0 ? (
            <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
              No data yet.
            </div>
          ) : (
            <ChartContainer
              config={barConfig}
              className="w-full"
              style={{ height: Math.max(160, categoryData.length * 44) }}
            >
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ left: 12, right: 16 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={6}>
                  {categoryData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
