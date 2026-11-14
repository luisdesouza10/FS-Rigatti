export type Role = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
}

/** The session token goes in an httpOnly cookie, never in the body. */
export interface AuthResponse {
  user: User;
  company: Company;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CategorySummary {
  category: string;
  count: number;
  minPrice: number;
  maxPrice: number;
}

export interface ToolCall {
  id?: string;
  name: string;
  input: Record<string, unknown>;
  resultCount?: number;
  isError?: boolean;
  pending?: boolean;
}

export interface ProductRef {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  products?: ProductRef[];
  streaming?: boolean;
  error?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: (Omit<ChatMessage, 'id'> & { id?: string; _id?: string })[];
}

/** A pending team invite. */
export interface Invitation {
  id: string;
  name: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt?: string;
}

/** The invite link is e-mailed to the invitee; the API never returns it. */
export interface InviteResult {
  invite: Invitation;
}
