import { AppShell, Burger, Group, Image, NavLink, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconDashboard, IconCar, IconMapPins } from "@tabler/icons-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import VehiclesPage from "./pages/VehiclesPage";
import BranchesPage from "./pages/BranchesPage";
import logo from "./assets/sahocars-logo.svg";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, to: "/" },
  { label: "Vehículos", icon: IconCar, to: "/vehiculos" },
  { label: "Sucursales", icon: IconMapPins, to: "/sucursales" },
];

export default function App() {
  const location = useLocation();
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="sm">
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
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap="xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                component={Link}
                to={item.to}
                label={item.label}
                leftSection={<Icon size={18} />}
                active={active}
                onClick={() => opened && toggle()}
              />
            );
          })}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="app-shell-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/vehiculos" element={<VehiclesPage />} />
          <Route path="/sucursales" element={<BranchesPage />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
