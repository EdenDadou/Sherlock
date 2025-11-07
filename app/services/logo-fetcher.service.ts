/**
 * Service pour récupérer les logos des dApps depuis différentes sources
 */

import axios from 'axios';

export class LogoFetcherService {
  /**
   * Essayer de récupérer le logo depuis plusieurs sources
   */
  async fetchLogo(protocol: {
    name: string;
    website?: string;
    github?: string;
    twitter?: string;
  }): Promise<string | null> {
    // 1. Essayer depuis DefiLlama
    const defiLlamaLogo = await this.fetchFromDefiLlama(protocol.name);
    if (defiLlamaLogo) return defiLlamaLogo;

    // 2. Essayer depuis CoinGecko
    const coinGeckoLogo = await this.fetchFromCoinGecko(protocol.name);
    if (coinGeckoLogo) return coinGeckoLogo;

    // 3. Générer un logo par défaut avec DiceBear
    return this.generateDefaultLogo(protocol.name);
  }

  /**
   * Récupérer depuis DefiLlama
   */
  private async fetchFromDefiLlama(name: string): Promise<string | null> {
    try {
      const response = await axios.get('https://api.llama.fi/protocols', {
        timeout: 5000,
      });

      const protocol = response.data.find((p: any) =>
        p.name?.toLowerCase() === name.toLowerCase()
      );

      return protocol?.logo || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Récupérer depuis CoinGecko
   */
  private async fetchFromCoinGecko(name: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(name)}`,
        { timeout: 5000 }
      );

      const coin = response.data.coins?.[0];
      return coin?.large || coin?.thumb || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Générer un logo par défaut
   */
  private generateDefaultLogo(name: string): string {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e293b`;
  }

  /**
   * Récupérer les followers Twitter (si disponible)
   */
  async fetchTwitterFollowers(twitterUrl?: string): Promise<number | null> {
    if (!twitterUrl) return null;

    try {
      // Extraire le handle Twitter
      const match = twitterUrl.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
      if (!match) return null;

      const handle = match[1];

      // Note: L'API Twitter v2 nécessite une clé API
      // Pour l'instant, on retourne null
      // À implémenter avec une clé API Twitter Bearer Token

      // Si vous avez une clé Twitter API:
      // const response = await axios.get(
      //   `https://api.twitter.com/2/users/by/username/${handle}?user.fields=public_metrics`,
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      //     }
      //   }
      // );
      // return response.data.data.public_metrics.followers_count;

      return null;
    } catch (error) {
      return null;
    }
  }
}

export const logoFetcherService = new LogoFetcherService();
