import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAccount } from "wagmi";

export default function Index() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();

  useEffect(() => {
    // Check if user is authenticated
    if (isConnected && address) {
      const authKey = `sherlock_auth_${address}`;
      const isAuthenticated = !!localStorage.getItem(authKey);

      if (isAuthenticated) {
        // User is logged in, redirect to home
        navigate("/home", { replace: true });
      } else {
        // User connected wallet but not signed, redirect to login
        navigate("/login", { replace: true });
      }
    } else {
      // No wallet connected, redirect to login
      navigate("/login", { replace: true });
    }
  }, [isConnected, address, navigate]);

  // Show loading state while checking authentication
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "#6b7280" }}>Loading...</div>
      </div>
    </div>
  );
}
