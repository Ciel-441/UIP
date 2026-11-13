export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  pfp_url?: string;
  nickname?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: 'Plant' | 'Animal' | 'Disease' | 'Chemical' | 'Climate' | 'Soil';
  description: string;
  properties: Record<string, any>;
  created_at: string;
  source_document_id?: string;
  connections?: { incoming: Relationship[]; outgoing: Relationship[] };
}

export interface Relationship {
  id: string;
  type: 'affects' | 'causes' | 'treated_by' | 'related_to' | 'depends_on' | 'found_in';
  source_id: string;
  target_id: string;
  source_name: string;
  target_name: string;
  description: string;
  created_at: string;
  source_evidence?: string[];
}

export interface Document {
  id: number;
  filename: string;
  original_name: string;
  status: 'uploaded' | 'processing' | 'extracted' | 'confirmed' | 'error';
  progress?: number;
  content_text?: string;
  user_id: number;
  created_at: string;
  entity_count?: number;
  extracted_entities?: any;
  extracted_relationships?: any;
}

export interface Activity {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
  user_id: number;
  user_name?: string;
}

export interface SearchResult {
  id: string;
  type: 'entity' | 'relationship' | 'document';
  name: string;
  description: string;
  relevance: number;
  related_entities?: string[];
  source_document?: string;
}

export interface DashboardStats {
  total_entities: number;
  total_relationships: number;
  total_documents: number;
  recent_activity_count: number;
}

export interface Citation {
  entity_id?: string;
  document_id?: number;
  name: string;
  type: string;
  excerpt: string;
}

export interface ExtractedEntity {
  name: string;
  type: string;
  description: string;
  properties: Record<string, any>;
}

export interface ExtractedRelationship {
  source_name: string;
  target_name: string;
  type: string;
  description: string;
}

export type EntityType = 'Plant' | 'Animal' | 'Disease' | 'Chemical' | 'Climate' | 'Soil';
export type RelationshipType = 'affects' | 'causes' | 'treated_by' | 'related_to' | 'depends_on' | 'found_in';

export const ENTITY_TYPES: EntityType[] = ['Plant', 'Animal', 'Disease', 'Chemical', 'Climate', 'Soil'];
export const RELATIONSHIP_TYPES: RelationshipType[] = ['affects', 'causes', 'treated_by', 'related_to', 'depends_on', 'found_in'];

export const ENTITY_COLORS: Record<EntityType, string> = {
  Plant: '#10b981',
  Animal: '#f59e0b',
  Disease: '#ef4444',
  Chemical: '#d68eff',
  Climate: '#06b6d4',
  Soil: '#d97706',
};
