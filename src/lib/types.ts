export type Language = 'zh' | 'en';
export type Category = 'tools' | 'news' | 'resources' | 'research' | 'prompts' | 'personal';
export type ContentStatus = 'draft' | 'needs_review' | 'published' | 'rejected' | 'archived';

export interface ContentGroup {
  id: string;
  canonicalSlug: string;
  category: Category;
  status: ContentStatus;
  heatScore: number;
  sourceQualityScore: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface Article {
  id: string;
  contentGroupId: string;
  language: Language;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  tags: string[];
  readingTime: number;
  seoTitle: string | null;
  seoDescription: string | null;
  category: Category;
  status: ContentStatus;
  heatScore: number;
  sourceQualityScore: number;
  publishedAt: string | null;
}

export interface Source {
  id: string;
  contentGroupId: string;
  url: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  sourceType: string;
  reliabilityScore: number;
  redirectUrl: string | null;
  groundingVerified: boolean;
  urlResolved: boolean;
}

export interface PersonalResource {
  id: string;
  language: Language;
  title: string;
  description: string;
  url: string;
  resourceType: string;
  isFeatured: boolean;
  sortOrder: number;
}

export type FeedbackStatus = 'new' | 'reviewing' | 'responded' | 'closed';
export type ClaimType = 'fact' | 'analysis' | 'prediction' | 'recommendation';
export type ClaimConfidence = 'high' | 'medium' | 'low';
export type EntityType = 'company' | 'product' | 'model' | 'protocol' | 'concept' | 'person' | 'organization' | 'other';

export interface FeedbackSubmission {
  id: string;
  language: Language;
  name: string | null;
  email: string | null;
  message: string;
  sourcePath: string | null;
  status: FeedbackStatus;
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleClaim {
  id: string;
  articleId: string;
  claimText: string;
  claimType: ClaimType;
  confidence: ClaimConfidence;
  sourceIds: string[];
  sortOrder: number;
}

export interface ArticleFaq {
  id: string;
  articleId: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface ArticleEntity {
  id: string;
  articleId: string;
  entityName: string;
  entityType: EntityType;
  canonicalUrl: string | null;
  sortOrder: number;
}

export interface ArticleUpdate {
  id: string;
  articleId: string;
  updateNote: string;
  createdAt: string;
}

export interface ResearchArtifacts {
  claims: ArticleClaim[];
  faqs: ArticleFaq[];
  entities: ArticleEntity[];
  updates: ArticleUpdate[];
}

export interface AdminDraftGroup {
  group: ContentGroup;
  articles: Article[];
  sources: Source[];
}
