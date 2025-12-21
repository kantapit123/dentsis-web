import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DashboardPage from "./pages/DashboardPage.tsx";
import QuickStockOutPage from "./pages/QuickStockOutPage.tsx";
import StockInPage from "./pages/StockInPage.tsx";
import StockMovementLogPage from "./pages/StockMovementLogPage.tsx";

function App() {
  const [currentPage, setCurrentPage] = useState<
    | "patients"
    | "appointments"
    | "stock-out"
    | "stock-in"
    | "dashboard"
    | "stock-log"
  >("dashboard");

  return (
    <div>
      {/* Simple navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex gap-4 flex-wrap">
          <button
            onClick={() => setCurrentPage("dashboard")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === "dashboard"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Dashboard
          </button>
          {/* <button
            onClick={() => setCurrentPage('patients')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === 'patients'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Patients
          </button>
          <button
            onClick={() => setCurrentPage('appointments')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === 'appointments'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Today's Appointments
          </button> */}
          <button
            onClick={() => setCurrentPage("stock-out")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === "stock-out"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Quick Stock Out
          </button>
          <button
            onClick={() => setCurrentPage("stock-in")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === "stock-in"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Stock In
          </button>
          <button
            onClick={() => setCurrentPage("stock-log")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === "stock-log"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Stock Log
          </button>
        </div>
      </nav>

      {/* Render current page */}
      {currentPage === "dashboard" ? (
        <DashboardPage />
      ) : currentPage === "stock-out" ? (
        <QuickStockOutPage />
      ) : currentPage === "stock-in" ? (
        <StockInPage />
      ) : currentPage === "stock-log" ? (
        <StockMovementLogPage />
      ) : (
        <DashboardPage />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
