import { AppShell, Button, Group, Image, Stack, Text } from "@mantine/core";
import { IconDashboard, IconCar, IconMapPins, IconChartBar } from "@tabler/icons-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import VehiclesPage from "./pages/VehiclesPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import BranchesPage from "./pages/BranchesPage";
import ReportsPage from "./pages/ReportsPage";
import logo from "./assets/sahocars-logo.svg";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, to: "/" },
  { label: "Vehículos", icon: IconCar, to: "/vehiculos" },
  { label: "Sucursales", icon: IconMapPins, to: "/sucursales" },
  { label: "Informes", icon: IconChartBar, to: "/informes" },
];

export default function App() {
  const location = useLocation();

  return (
    <AppShell
      className="app-shell-root"
      header={{ height: 88 }}
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
          </Routes>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
