export interface Taxon {
  slug: string;
  name: string;
}
export interface PublicPost {
  slug: string;
  title: string;
  summary: string;
  html: string;
  published_at: string;
  category: Taxon;
  tags: Taxon[];
}
export interface Snapshot {
  schema_version: 1;
  id: string;
  created_at: string;
  site_title: string;
  page_size: number;
  posts: PublicPost[];
}
export interface Draft {
  slug: string;
  title: string;
  summary: string;
  markdown: string;
  published_at: string;
  category: Taxon;
  tags: Taxon[];
  base_revision_id: number;
}
export interface AdminPost extends Draft {
  id: number;
  revision_id: number;
  html: string;
}
