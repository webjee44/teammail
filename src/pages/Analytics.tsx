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
import { Clock, MessageSquare, Users, TrendingUp } from "lucide-react";

const volumeData = [
  { day: "Lun", emails: 24 },
  { day: "Mar", emails: 31 },
  { day: "Mer", emails: 18 },
  { day: "Jeu", emails: 29 },
  { day: "Ven", emails: 35 },
  { day: "Sam", emails: 8 },
  { day: "Dim", emails: 5 },
];

const responseTimeData = [
  { day: "Lun", minutes: 12 },
  { day: "Mar", minutes: 18 },
  { day: "Mer", minutes: 8 },
  { day: "Jeu", minutes: 15 },
  { day: "Ven", minutes: 22 },
  { day: "Sam", minutes: 45 },
  { day: "Dim", minutes: 60 },
];

const statusData = [
  { name: "Ouvert", value: 12, color: "hsl(142, 72%, 40%)" },
  { name: "En pause", value: 5, color: "hsl(38, 92%, 50%)" },
  { name: "Fermé", value: 28, color: "hsl(220, 10%, 46%)" },
];

const teamData = [
  { name: "Alex", conversations: 15, avgResponse: 12 },
  { name: "Sarah", conversations: 22, avgResponse: 8 },
  { name: "Thomas", conversations: 8, avgResponse: 18 },
];

const Analytics = () => {
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
                  <p className="text-2xl font-bold">150</p>
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
                  <p className="text-2xl font-bold">14 min</p>
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
                  <p className="text-2xl font-bold">92%</p>
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
                  <p className="text-2xl font-bold">3</p>
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
                      <Bar dataKey="emails" fill="hsl(236, 72%, 58%)" radius={[4, 4, 0, 0]} />
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
              </CardHeader>
              <CardContent>
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
                      fill="hsl(236, 72%, 58%)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Analytics;
