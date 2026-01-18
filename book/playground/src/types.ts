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
}
