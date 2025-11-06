import type { LoaderFunctionArgs } from "react-router";
import { discoveryScannerService } from "../../../services/discovery-scanner.service";
import type {
  ScanProgress,
  DiscoveredDApp,
} from "../../../services/discovery-scanner.service";

export async function loader({ request }: LoaderFunctionArgs) {
  // Server-Sent Events pour le streaming en temps réel
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Fonction pour envoyer des données SSE
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Envoyer l'état initial
      sendEvent("progress", discoveryScannerService.getProgress());

      // Écouter les événements de progression
      const onProgress = (progress: ScanProgress) => {
        sendEvent("progress", progress);
      };

      const onDAppDiscovered = (dapp: DiscoveredDApp) => {
        sendEvent("dapp-discovered", dapp);
      };

      const onCompleted = (progress: ScanProgress) => {
        sendEvent("completed", progress);
      };

      const onError = (progress: ScanProgress) => {
        sendEvent("error", progress);
      };

      const onStopped = (progress: ScanProgress) => {
        sendEvent("stopped", progress);
      };

      // Attacher les listeners
      discoveryScannerService.on("progress", onProgress);
      discoveryScannerService.on("dapp-discovered", onDAppDiscovered);
      discoveryScannerService.on("completed", onCompleted);
      discoveryScannerService.on("error", onError);
      discoveryScannerService.on("stopped", onStopped);

      // Heartbeat toutes les 30 secondes pour maintenir la connexion
      const heartbeat = setInterval(() => {
        try {
          sendEvent("heartbeat", { timestamp: Date.now() });
        } catch (error) {
          // La connexion est fermée
          clearInterval(heartbeat);
        }
      }, 30000);

      // Nettoyage quand le client se déconnecte
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        discoveryScannerService.off("progress", onProgress);
        discoveryScannerService.off("dapp-discovered", onDAppDiscovered);
        discoveryScannerService.off("completed", onCompleted);
        discoveryScannerService.off("error", onError);
        discoveryScannerService.off("stopped", onStopped);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
