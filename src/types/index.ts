export type AppScreen = "upload" | "tutor";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  pageNumber: number;
  role: ChatRole;
  content: string;
};

export type PdfSource = File | string;
