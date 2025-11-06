import React from "react";
import {
  useConnect,
  useDisconnect,
  useAccount,
  useSignMessage,
  useConnectors,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { monadTestnet } from "../wagmi";
import { buildSiweMessage, getBrowserContext } from "../lib/siwe";
import {
  getNonce,
  verifySignatureLocally,
  verifySignatureOnServer,
} from "../lib/authClient";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSigned: (signature: string) => void;
  requireSignature?: boolean; // when true, modal acts as a blocking gate until signature success
}

const FALLBACK_MESSAGE = "Sherlock access login (fallback)";

export function LoginModal({
  open,
  onClose,
  onSigned,
  requireSignature,
}: LoginModalProps) {
  const requireServerVerify =
    (import.meta as any).env?.VITE_SIWE_REQUIRE_SERVER === "true";
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [connectLock, setConnectLock] = React.useState<string | null>(null);
  const { connect, isPending, error: connectError } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const {
    switchChain,
    isPending: switching,
    error: switchError,
  } = useSwitchChain();
  const {
    signMessage,
    data: signature,
    isPending: signing,
    error: signError,
    reset: resetSign,
    isSuccess,
  } = useSignMessage();
  const signRequestedRef = React.useRef(false);
  const gateActiveRef = React.useRef(false);
  const autoSwitchTriedRef = React.useRef(false);
  const [signStartTs, setSignStartTs] = React.useState<number | null>(null);
  const [retryFlag, setRetryFlag] = React.useState(false);
  const [nonce, setNonce] = React.useState<string | null>(null);
  const [dynamicMessage, setDynamicMessage] = React.useState<string | null>(
    null
  );
  const [localVerifyError, setLocalVerifyError] = React.useState<string | null>(
    null
  );
  const [serverVerifying, setServerVerifying] = React.useState(false);

  // Reset & prepare SIWE message on open/connect
  React.useEffect(() => {
    let cancelled = false;
    async function prep() {
      if (!open) return;
      signRequestedRef.current = false;
      gateActiveRef.current = false;
      autoSwitchTriedRef.current = false;
      resetSign();
      setLocalVerifyError(null);
      setDynamicMessage(null);
      setNonce(null);
      if (isConnected && address) {
        const n = await getNonce();
        if (cancelled) return;
        setNonce(n);
        const { domain, uri } = getBrowserContext();
        const msg = buildSiweMessage({
          domain,
          address,
          uri,
          chainId: chainId,
          nonce: n,
          statement: "Sign in to Sherlock",
        });
        setDynamicMessage(msg);
      }
    }
    prep();
    return () => {
      cancelled = true;
    };
  }, [open, resetSign, isConnected, address, chainId]);

  // If connected on wrong network while modal is open, auto-attempt one switch to Monad Testnet
  React.useEffect(() => {
    if (!open) return;
    if (
      isConnected &&
      chainId !== monadTestnet.id &&
      !autoSwitchTriedRef.current
    ) {
      autoSwitchTriedRef.current = true;
      try {
        switchChain({ chainId: monadTestnet.id });
      } catch {}
    }
    if (chainId === monadTestnet.id) {
      // allow another attempt if user manually changed back
      autoSwitchTriedRef.current = false;
    }
  }, [open, isConnected, chainId, switchChain]);

  // Remove obsolete post-sign switch handler (was used in previous flow)

  // When signature succeeds, perform local verification before closing.
  React.useEffect(() => {
    async function finalize() {
      if (
        !(open && signRequestedRef.current && isSuccess && signature && address)
      )
        return;
      const msgToVerify = dynamicMessage || FALLBACK_MESSAGE;
      const local = await verifySignatureLocally({
        address,
        message: msgToVerify,
        signature,
      });
      if (!local.ok) {
        setLocalVerifyError(local.error || "Local verify failed");
        return; // keep modal open so user can retry
      }
      // Server verify (SIWE) – optional in dev unless VITE_SIWE_REQUIRE_SERVER=true
      if (requireServerVerify) {
        setServerVerifying(true);
        const server = await verifySignatureOnServer({
          address,
          message: msgToVerify,
          signature,
        });
        if (!server.ok) {
          setServerVerifying(false);
          setLocalVerifyError(server.error || "Server verify failed");
          return;
        }
      }
      gateActiveRef.current = false;
      onSigned(signature);
      onClose();
    }
    finalize();
  }, [open, isSuccess, signature, address, dynamicMessage, onSigned, onClose]);

  if (!open) return null;

  const hasInjected =
    typeof window !== "undefined" && !!(window as any).ethereum;

  // Verrouillage strict: dès qu'un wallet est connecté (écran de sign-in),
  // on bloque la fermeture du modal (clic dehors / croix). "Disconnect" reste possible.
  // Cela évite toute désynchronisation avec des états externes.
  const lockClose = isConnected;
  // On conserve une notion d'activité de gate pour l'UI (état de signature/vérif)
  const signingGateActive = lockClose && (!isSuccess || serverVerifying);
  gateActiveRef.current = lockClose;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onClick={(e) => {
        // Autoriser la fermeture uniquement si pas de lock
        if (!lockClose) onClose();
      }}
    >
      <div className="bg-white rounded-xl py-6 px-7 pb-8 w-[360px] shadow-[0_8px_28px_-6px_rgba(0,0,0,0.25)] relative grid gap-5 text-gray-900 text-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="m-0 text-xl font-semibold text-gray-900">Connect wallet</h2>
        {!isConnected ? (
          <div className="grid gap-3.5 text-gray-900">
            <div className="grid gap-2">
              {connectors.map((c) => {
                const locked = !!connectLock && connectLock !== c.id;
                const disabled = isPending || locked;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (disabled) return;
                      setConnectLock(c.id);
                      try {
                        // Request connect on Monad Testnet directly
                        // Wallets that don't have the chain will prompt to add it
                        // If passing chainId is unsupported by a connector, it will be ignored
                        // and the auto-switch handler below will attempt a switch post-connect
                        // ensuring we end up on Monad before signing.
                        connect({ connector: c, chainId: monadTestnet.id });
                      } finally {
                        // Release lock shortly after to allow wallet UI to appear without immediate spam
                        setTimeout(() => setConnectLock(null), 400);
                      }
                    }}
                    disabled={disabled}
                    aria-busy={disabled}
                    className={`py-2.5 px-3.5 rounded-[10px] border border-gray-300 text-sm font-medium ${
                      disabled
                        ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                        : "bg-gray-900 text-white cursor-pointer hover:bg-gray-800 transition-colors"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <small className="text-gray-700 text-xs">
              Select a wallet. Network will auto-switch to Monad Testnet.
            </small>
            {connectError && (
              <div className="text-red-700 text-[13px] font-medium">
                Connection error: {connectError.message}
                {connectError.message?.includes(
                  "wallet_requestPermissions"
                ) && (
                  <div className="mt-1.5">
                    A request is already open in your wallet. Approve or close
                    the popup, then try again.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3.5 text-gray-900">
            <div className="grid gap-1 text-sm text-gray-900">
              <div className="text-gray-900 font-medium">Address</div>
              <div className="font-mono text-[13px] break-all text-gray-900">{address}</div>
            </div>
            {chainId !== monadTestnet.id && (
              <div className="grid gap-2.5 p-3 border border-gray-200 rounded-[10px] bg-orange-50 text-orange-900">
                <div className="font-semibold">Wrong network</div>
                <div>Please switch to Monad Testnet to continue.</div>
                <button
                  onClick={() => switchChain({ chainId: monadTestnet.id })}
                  disabled={switching}
                  className={`py-2.5 px-3.5 rounded-[10px] border border-gray-300 text-sm font-medium ${
                    switching
                      ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                      : "bg-gray-900 text-white cursor-pointer hover:bg-gray-800 transition-colors"
                  }`}
                >
                  {switching ? "Switching…" : "Switch to Monad Testnet"}
                </button>
                {switchError && (
                  <div className="text-red-700 text-[13px] font-medium">
                    Switch error: {switchError.message}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 flex-wrap text-gray-900">
              <button
                onClick={() => {
                  // Clear signature state and allow re-selection
                  resetSign();
                  signRequestedRef.current = false;
                  disconnect();
                }}
                className="py-2.5 px-3.5 rounded-[10px] border border-gray-300 bg-white text-gray-900 cursor-pointer text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Disconnect
              </button>
              <button
                onClick={() => {
                  if (chainId !== monadTestnet.id) {
                    try {
                      switchChain({ chainId: monadTestnet.id });
                    } catch {}
                    return;
                  }
                  signRequestedRef.current = true;
                  if (address) {
                    try {
                      localStorage.setItem(`sherlock_pending_${address}`, "1");
                    } catch {}
                  }
                  setRetryFlag(false);
                  setSignStartTs(Date.now());
                  signMessage({ message: dynamicMessage || FALLBACK_MESSAGE });
                }}
                disabled={
                  signing || chainId !== monadTestnet.id || !dynamicMessage
                }
                className={`py-2.5 px-3.5 rounded-[10px] border border-gray-300 text-sm font-medium ${
                  signing || chainId !== monadTestnet.id || !dynamicMessage
                    ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                    : "bg-gray-900 text-white cursor-pointer hover:bg-gray-800 transition-colors"
                }`}
              >
                {signing
                  ? "Signing…"
                  : dynamicMessage
                    ? "Sign to continue"
                    : "Preparing…"}
              </button>
              {signing && signStartTs && Date.now() - signStartTs > 15000 && (
                <div className="text-xs text-orange-900">
                  Signature taking longer than usual. You can retry.
                  <div className="mt-1.5">
                    <button
                      onClick={() => {
                        resetSign();
                        setRetryFlag(true);
                        setSignStartTs(Date.now());
                        signMessage({
                          message: dynamicMessage || FALLBACK_MESSAGE,
                        });
                      }}
                      className="py-2.5 px-3.5 rounded-[10px] border border-gray-300 bg-white text-gray-900 cursor-pointer text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Retry signature
                    </button>
                  </div>
                </div>
              )}
              {retryFlag && !signing && !isSuccess && !signError && (
                <div className="text-xs text-gray-500">
                  Retry initiated. Await wallet popup…
                </div>
              )}
            </div>
            {(serverVerifying || signError || localVerifyError) && (
              <div className={`text-[13px] font-medium ${serverVerifying ? "text-gray-500" : "text-red-700"}`}>
                {serverVerifying && "Verifying signature on server…"}
                {signError && <div>Signature error: {signError.message}</div>}
                {localVerifyError && <div>Auth error: {localVerifyError}</div>}
              </div>
            )}
          </div>
        )}
        {!lockClose && (
          <button
            onClick={() => {
              onClose();
            }}
            className="absolute top-2 right-2.5 bg-transparent border-none text-[22px] cursor-pointer leading-none text-gray-900 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
