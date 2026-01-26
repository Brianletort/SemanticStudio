/**
 * File Processor Types
 * 
 * Types for file upload, processing, and content extraction
 * Used by the chat system to handle various document formats
 */

// Supported file types
export type SupportedFileType = 
  | 'text/plain'
  | 'text/markdown'
  | 'text/csv'
  | 'application/json'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'  // docx
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'        // xlsx
  | 'application/vnd.ms-excel'                                                  // xls
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation' // pptx
  | 'application/vnd.ms-powerpoint'                                             // ppt
  | 'application/msword'                                                        // doc
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

// File extension to MIME type mapping
export const FILE_EXTENSION_MAP: Record<string, SupportedFileType> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Supported MIME types set
export const SUPPORTED_MIME_TYPES = new Set<string>(Object.values(FILE_EXTENSION_MAP));

// File processing request
export interface FileProcessRequest {
  file: Buffer | ArrayBuffer;
  fileName: string;
  mimeType: string;
  maxContentLength?: number;  // Limit extracted text length
}

// Processed file result
export interface ProcessedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  extractedContent: string;
  metadata: FileMetadata;
  processingTimeMs: number;
  // For images: base64 data URL for vision model processing
  imageData?: string;  // data:image/png;base64,... format
}

// File metadata based on type
export interface FileMetadata {
  pageCount?: number;       // PDF, PPTX
  slideCount?: number;      // PPTX
  sheetCount?: number;      // XLSX
  wordCount?: number;       // All text files
  characterCount?: number;  // All text files
  imageWidth?: number;      // Images
  imageHeight?: number;     // Images
  truncated?: boolean;      // If content was truncated
  originalLength?: number;  // Original length before truncation
}

// File processing error
export interface FileProcessError {
  code: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'EXTRACTION_FAILED' | 'INVALID_FILE';
  message: string;
  details?: string;
}

// File processing result (success or error)
export type FileProcessResult = 
  | { success: true; data: ProcessedFile }
  | { success: false; error: FileProcessError };

// Configuration for file processing
export interface FileProcessorConfig {
  maxFileSizeBytes: number;        // Default: 10MB
  maxContentLength: number;        // Max characters to extract (default: 100000)
  enableImageOCR?: boolean;        // OCR for images (future)
  verbose?: boolean;
}

// Default configuration
export const DEFAULT_CONFIG: FileProcessorConfig = {
  maxFileSizeBytes: 10 * 1024 * 1024,  // 10MB
  maxContentLength: 100000,             // ~100K characters
  enableImageOCR: false,
  verbose: false,
};
