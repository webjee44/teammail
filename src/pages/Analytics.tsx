import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Clock, MessageSquare, Users, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [totalConvos, setTotalConvos] = useState(0);
  const [avgResponseMin, setAvgResponseMin] = useState<number | null>(null);
  const [resolutionRate, setResolutionRate] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [volumeData, setVolumeData] = useState<{ day: string; emails: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<{ day: string; minutes: number }[]>([]);
  const [teamData, setTeamData] = useState<{ name: string; conversations: number }[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all conversations (last 30 days for KPIs)
    const { data: convos30 } = await supabase
      .from("conversations")
      .select("id, status, created_at, assigned_to, last_message_at")
      .gte("created_at", thirtyDaysAgo.toISOString());

    const allConvos = convos30 || [];
    setTotalConvos(allConvos.length);

    // Resolution rate: closed / total
    const closedCount = allConvos.filter((c) => c.status === "closed").length;
    setResolutionRate(allConvos.length > 0 ? Math.round((closedCount / allConvos.length) * 100) : 0);

    // Status breakdown (all conversations, not just 30d)
    const { data: allConvosStatus } = await supabase
      .from("conversations")
      .select("status");
    const statusCounts = { open: 0, snoozed: 0, closed: 0 };
    for (const c of allConvosStatus || []) {
      if (c.status in statusCounts) statusCounts[c.status as keyof typeof statusCounts]++;
    }
    setStatusData([
      { name: "Ouvert", value: statusCounts.open, color: "hsl(142, 72%, 40%)" },
      { name: "En pause", value: statusCounts.snoozed, color: "hsl(38, 92%, 50%)" },
      { name: "Fermé", value: statusCounts.closed, color: "hsl(220, 10%, 46%)" },
    ]);

    // Volume per day (last 7 days)
    const volumeMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = DAY_LABELS[d.getDay()];
      volumeMap.set(`${i}-${label}`, 0);
    }

    const { data: convos7 } = await supabase
      .from("conversations")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString());

    // Map conversations to day buckets
    const dayBuckets: number[] = new Array(7).fill(0);
    for (const c of convos7 || []) {
      const d = new Date(c.created_at);
      const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 0 && daysAgo < 7) {
        dayBuckets[6 - daysAgo]++;
      }
    }
    const volumeArr: { day: string; emails: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      volumeArr.push({ day: DAY_LABELS[d.getDay()], emails: dayBuckets[6 - i] });
    }
    setVolumeData(volumeArr);

    // Average response time: for each inbound message, find first outbound reply
    const { data: messages } = await supabase
      .from("messages")
      .select("conversation_id, is_outbound, sent_at")
      .gte("sent_at", sevenDaysAgo.toISOString())
      .order("sent_at", { ascending: true });

    const responseTimes: number[] = [];
    const responseByDay: Map<number, number[]> = new Map();

    if (messages && messages.length > 0) {
      // Group by conversation
      const byConvo = new Map<string, typeof messages>();
      for (const m of messages) {
        const list = byConvo.get(m.conversation_id) || [];
        list.push(m);
        byConvo.set(m.conversation_id, list);
      }

      for (const [, msgs] of byConvo) {
        for (let i = 0; i < msgs.length; i++) {
          if (!msgs[i].is_outbound) {
            // Find next outbound
            for (let j = i + 1; j < msgs.length; j++) {
              if (msgs[j].is_outbound) {
                const diff = (new Date(msgs[j].sent_at).getTime() - new Date(msgs[i].sent_at).getTime()) / 60000;
                if (diff > 0 && diff < 1440) { // < 24h
                  responseTimes.push(diff);
                  const d = new Date(msgs[i].sent_at);
                  const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysAgo >= 0 && daysAgo < 7) {
                    const list = responseByDay.get(daysAgo) || [];
                    list.push(diff);
                    responseByDay.set(daysAgo, list);
                  }
                }
                break;
              }
            }
          }
        }
      }
    }

    setAvgResponseMin(
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null
    );

    // Response time per day chart
    const rtArr: { day: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const times = responseByDay.get(i) || [];
      const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
      rtArr.push({ day: DAY_LABELS[d.getDay()], minutes: avg });
    }
    setResponseTimeData(rtArr);

    // Team members count + conversations per member
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email");
    setMemberCount(profiles?.length || 0);

    // Conversations assigned per member
    const memberMap = new Map<string, { name: string; count: number }>();
    for (const p of profiles || []) {
      memberMap.set(p.user_id, {
        name: p.full_name || p.email || "Inconnu",
        count: 0,
      });
    }
    for (const c of allConvos) {
      if (c.assigned_to && memberMap.has(c.assigned_to)) {
        memberMap.get(c.assigned_to)!.count++;
      }
    }
    setTeamData(
      Array.from(memberMap.values())
        .map((m) => ({ name: m.name.split(" ")[0], conversations: m.count }))
        .sort((a, b) => b.conversations - a.conversations)
    );

    setLoading(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Statistiques</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble des performances de votre équipe
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalConvos}</p>
                  <p className="text-xs text-muted-foreground">Conversations (30j)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {avgResponseMin !== null ? `${avgResponseMin} min` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Temps de réponse moyen</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {resolutionRate !== null ? `${resolutionRate}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Taux de résolution</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memberCount}</p>
                  <p className="text-xs text-muted-foreground">Membres actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="volume">
          <TabsList>
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="response">Temps de réponse</TabsTrigger>
            <TabsTrigger value="team">Par membre</TabsTrigger>
          </TabsList>

          <TabsContent value="volume">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Volume de conversations</CardTitle>
                  <CardDescription>7 derniers jours</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={volumeData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" className="text-xs fill-muted-foreground" />
                      <YAxis className="text-xs fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="emails" name="Conversations" fill="hsl(236, 72%, 58%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Par statut</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        paddingAngle={4}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    {statusData.map((s) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name} ({s.value})
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="response">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Temps de réponse moyen</CardTitle>
                <CardDescription>En minutes, sur les 7 derniers jours</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="minutes"
                      name="Minutes"
                      stroke="hsl(236, 72%, 58%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(236, 72%, 58%)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance par membre</CardTitle>
                <CardDescription>Conversations assignées (30 derniers jours)</CardDescription>
              </CardHeader>
              <CardContent>
                {teamData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={teamData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-xs fill-muted-foreground" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        className="text-xs fill-muted-foreground"
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="conversations"
                        name="Conversations"
                        fill="hsl(236, 72%, 58%)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Analytics;