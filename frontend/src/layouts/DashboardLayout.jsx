import Header from "../components/Header";
import Navbar from "../components/Navbar";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div>
      <Header />
      <Navbar />

      {/* This is where pages change */}
      <main style={{ padding: "24px" }}>
        <Outlet />
      </main>
    </div>
  );
}
