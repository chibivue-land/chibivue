export interface ChapterFile {
  path: string;
  content: string;
}

export interface Chapter {
  id: string;
  section: string;
  sectionOrder: string;
  name: string;
  files: ChapterFile[];
  bookUrl: string; // URL to the online book chapter
  vueDocUrl?: string; // Optional URL to related Vue.js documentation
}
