import { useEffect, useState } from "react";
import { AppShell, Button, Group, Image, Stack, Text } from "@mantine/core";
import { IconDashboard, IconCar, IconMapPins, IconChartBar, IconPlug } from "@tabler/icons-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import VehiclesPage from "./pages/VehiclesPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import BranchesPage from "./pages/BranchesPage";
import ReportsPage from "./pages/ReportsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import IntegrationsGuidePage from "./pages/IntegrationsGuidePage";
import logo from "./assets/sahocars-logo.svg";
import { APP_BRANCH, APP_COMMIT, APP_VERSION } from "./lib/buildInfo";
import { api } from "./lib/api";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, to: "/" },
  { label: "Vehículos", icon: IconCar, to: "/vehiculos" },
  { label: "Sucursales", icon: IconMapPins, to: "/sucursales" },
  { label: "Informes", icon: IconChartBar, to: "/informes" },
  { label: "Integraciones", icon: IconPlug, to: "/settings/integrations" },
];

export default function App() {
  const location = useLocation();
  const [buildInfo, setBuildInfo] = useState({
    version: APP_VERSION,
    branch: APP_BRANCH,
    commit: APP_COMMIT,
  });

  useEffect(() => {
    api
      .getAppVersionInfo()
      .then((info) => {
        if (info?.version) {
          setBuildInfo({
            version: info.version,
            branch: info.branch ?? APP_BRANCH,
            commit: info.commit ?? APP_COMMIT,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AppShell
      className="app-shell-root"
      header={{ height: 88 }}
      footer={{ height: 40 }}
      padding="md"
    >
      <AppShell.Header>
        <div className="page-container header-container">
          <Group h="100%" justify="space-between">
            <Group gap="sm" wrap="nowrap">
              <Image src={logo} alt="Sahocars" h={48} w="auto" className="logo" />
              <Stack gap={0}>
                <Text fw={700} size="lg" c="#2b2b2b">
                  Sahocars
                </Text>
                <Text size="sm" c="dimmed">
                  Montgat · Juneda
                </Text>
              </Stack>
            </Group>
            <Group gap="xs" wrap="wrap">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
                return (
                  <Button
                    key={item.to}
                    variant={active ? "light" : "subtle"}
                    color="teal"
                    leftSection={<Icon size={16} />}
                    component={Link}
                    to={item.to}
                    size="sm"
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Group>
          </Group>
        </div>
      </AppShell.Header>

      <AppShell.Main className="app-shell-main">
        <div className="page-container">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/vehiculos" element={<VehiclesPage />} />
            <Route path="/vehiculos/:licensePlate" element={<VehicleDetailPage />} />
            <Route path="/sucursales" element={<BranchesPage />} />
            <Route path="/informes" element={<ReportsPage />} />
            <Route path="/settings/integrations" element={<IntegrationsPage />} />
            <Route path="/settings/integrations/guide" element={<IntegrationsGuidePage />} />
          </Routes>
        </div>
      </AppShell.Main>
      <AppShell.Footer>
        <div className="page-container">
          <Group h="100%" justify="space-between">
            <Text size="xs" c="dimmed">
              Sahocars v{buildInfo.version} · {buildInfo.branch} · {buildInfo.commit}
            </Text>
          </Group>
        </div>
      </AppShell.Footer>
    </AppShell>
  );
}
