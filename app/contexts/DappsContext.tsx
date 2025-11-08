import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface DApp {
  id: string;
  name: string | null;
  description: string | null;
  logoUrl: string | null;
  banner: string | null;
  symbol: string | null;
  category: string;
  website: string | null;
  github: string | null;
  twitter: string | null;
  contractCount: number;
  contracts?: any[];
  totalTxCount: number;
  totalEventCount: number;
  uniqueUsers: number;
  activityScore: number;
  qualityScore: number;
  firstActivity: Date | null;
  lastActivity: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DappsContextValue {
  dapps: DApp[];
  loading: boolean;
  error: string | null;
  syncDapps: () => Promise<void>;
}

const DappsContext = createContext<DappsContextValue | undefined>(undefined);

export function DappsProvider({ children }: { children: ReactNode }) {
  const [dapps, setDapps] = useState<DApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load dApps from database
   */
  const loadDapps = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/dapps");
      if (!response.ok) {
        throw new Error(`Failed to load dApps: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setDapps(data.dapps);
      } else {
        throw new Error(data.error || "Failed to load dApps");
      }
    } catch (err) {
      console.error("Error loading dApps:", err);
      setError(err instanceof Error ? err.message : "Failed to load dApps");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sync dApps from GitHub + Google Sheets
   */
  const syncDapps = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/dapps/sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to sync dApps: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        // Reload dApps after sync
        await loadDapps();
      } else {
        throw new Error(data.error || "Failed to sync dApps");
      }
    } catch (err) {
      console.error("Error syncing dApps:", err);
      setError(err instanceof Error ? err.message : "Failed to sync dApps");
    } finally {
      setLoading(false);
    }
  };

  // Load dApps on mount
  useEffect(() => {
    loadDapps();
  }, []);

  return (
    <DappsContext.Provider value={{ dapps, loading, error, syncDapps }}>
      {children}
    </DappsContext.Provider>
  );
}

export function useDappsContext() {
  const context = useContext(DappsContext);
  if (context === undefined) {
    throw new Error("useDappsContext must be used within a DappsProvider");
  }
  return context;
}
