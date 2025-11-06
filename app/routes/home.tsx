import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAccount, useDisconnect } from "wagmi";
import { Welcome } from "../components/Welcome";

export function meta() {
  return [
    { title: "Home - Sherlock" },
    { name: "description", content: "Welcome to Sherlock!" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // Protect the route - redirect to login if not authenticated
  useEffect(() => {
    if (!isConnected || !address) {
      navigate("/login", { replace: true });
      return;
    }

    const authKey = `sherlock_auth_${address}`;
    const isAuthenticated = !!localStorage.getItem(authKey);

    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isConnected, address, navigate]);

  const handleDisconnect = () => {
    if (address) {
      // Clear authentication data
      localStorage.removeItem(`sherlock_auth_${address}`);
      localStorage.removeItem(`sherlock_pending_${address}`);
    }
    disconnect();
    navigate("/login");
  };

  return (
    <div>
      <header
        style={{
          padding: "16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Sherlock</h1>
        <button
          onClick={handleDisconnect}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fafafa",
            color: "#111",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Disconnect
        </button>
      </header>
      <Welcome />
    </div>
  );
}
