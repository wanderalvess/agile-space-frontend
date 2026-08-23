export type KnowledgeDocStatus = 'indexed' | 'published' | 'pending' | 'error' | 'trash' | 'deleted';
export type KnowledgeDocCategory = 'Técnico' | 'Processo' | 'Produto' | 'Outro';

export interface KnowledgeDocument {
  id: string;
  tdnId?: string; // ID vindo da importação externa do TDN/Confluence (coluna 'tdn_id', única e opcional)
  title: string;
  content: string;
  category: string; // Mudado para string para permitir flexibilidade total de caminhos
  fullPath?: string; // Caminho completo: "Módulo / Pasta / Subpasta"
  moduleId?: string;
  moduleName?: string;
  folderId?: string;
  folderName?: string;
  status: KnowledgeDocStatus;
  authorId: string;
  tags?: string[];
  byteSize: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  // Contador de visualizações (persistido no Firestore; usado nas métricas).
  views?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    tokens?: number;
    sources?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export interface UserAIConfig {
  userId: string;
  geminiKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  preferredModel?: string;
}
