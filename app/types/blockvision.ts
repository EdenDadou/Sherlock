/**
 * Types pour l'API BlockVision Monad Indexing
 */

export interface BlockVisionConfig {
  apiKey: string;
  baseUrl: string;
  chainId: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: string;
  blockHash: string;
  timestamp: string;
  gas: string;
  gasPrice: string;
  gasUsed?: string;
  input: string;
  nonce: string;
  transactionIndex: string;
  status?: string;
  contractAddress?: string | null;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  from: string;
  to: string | null;
  contractAddress: string | null;
  status: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  logs: Log[];
}

export interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}

export interface Block {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  transactions: string[] | Transaction[];
  gasLimit: string;
  gasUsed: string;
  miner: string;
}

export interface AccountTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timestamp: string;
  methodId?: string;
  functionName?: string;
}

export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: 'ERC20' | 'ERC721' | 'ERC1155';
  balance?: string;
}

export interface ContractEvent {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  eventName?: string;
  args?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
