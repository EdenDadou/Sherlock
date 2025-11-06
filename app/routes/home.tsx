import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

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

  const handleScanDApps = async () => {
    setIsScanning(true);
    setScanResult(null);

    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=scan-blocks',
      });

      const result = await response.json();

      if (result.success) {
        setScanResult(result.message);
        // Optionally redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setScanResult(`Error: ${result.error}`);
      }
    } catch (error) {
      setScanResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScanning(false);
    }
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

      <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
        <Welcome />

        {/* dApp Discovery Section */}
        <div style={{
          marginTop: "48px",
          padding: "32px",
          background: "#f9fafb",
          borderRadius: "12px",
          border: "1px solid #e5e7eb"
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: "16px" }}>
            🔍 Monad dApp Discovery
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "24px" }}>
            Scan the Monad Testnet blockchain to discover new decentralized applications,
            track their activity, and analyze their performance.
          </p>

          <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
            <button
              onClick={handleScanDApps}
              disabled={isScanning}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "none",
                background: isScanning ? "#9ca3af" : "#3b82f6",
                color: "white",
                cursor: isScanning ? "not-allowed" : "pointer",
                fontSize: 16,
                fontWeight: 600,
                transition: "background 0.2s",
              }}
            >
              {isScanning ? "Scanning..." : "🚀 Scan for New dApps"}
            </button>

            <Link
              to="/dashboard"
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid #3b82f6",
                background: "white",
                color: "#3b82f6",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              📊 View Dashboard
            </Link>

            <Link
              to="/dapps"
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid #10b981",
                background: "white",
                color: "#10b981",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              📱 Browse dApps
            </Link>
          </div>

          {scanResult && (
            <div style={{
              padding: "12px 16px",
              borderRadius: 8,
              background: scanResult.includes("Error") ? "#fee2e2" : "#d1fae5",
              color: scanResult.includes("Error") ? "#991b1b" : "#065f46",
              fontSize: 14,
            }}>
              {scanResult}
            </div>
          )}

          <div style={{
            marginTop: "32px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px"
          }}>
            <div style={{ padding: "16px", background: "white", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: "8px" }}>Features</div>
              <ul style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, paddingLeft: "20px" }}>
                <li>Automatic contract detection</li>
                <li>Smart categorization (DeFi, NFT, GameFi, etc.)</li>
                <li>Real-time activity tracking</li>
              </ul>
            </div>

            <div style={{ padding: "16px", background: "white", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: "8px" }}>Categories</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                {["DeFi", "NFT", "GameFi", "Social", "Bridge", "Infra"].map(cat => (
                  <span key={cat} style={{
                    padding: "4px 12px",
                    background: "#eff6ff",
                    color: "#1e40af",
                    borderRadius: "12px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ padding: "16px", background: "white", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: "8px" }}>Quick Links</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link to="/dashboard" style={{ color: "#3b82f6", textDecoration: "none", fontSize: 14 }}>
                  → Dashboard
                </Link>
                <Link to="/dapps" style={{ color: "#3b82f6", textDecoration: "none", fontSize: 14 }}>
                  → All dApps
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
