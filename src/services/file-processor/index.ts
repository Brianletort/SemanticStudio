/**
 * File Processor Service
 * 
 * Extracts text content from various file formats for use as chat context.
 * Supports: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, MD, CSV, JSON, and images
 */

import * as crypto from 'crypto';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
// Note: officeparser is imported dynamically to handle different API versions
import {
  type FileProcessRequest,
  type FileProcessResult,
  type ProcessedFile,
  type FileMetadata,
  type FileProcessorConfig,
  SUPPORTED_MIME_TYPES,
  FILE_EXTENSION_MAP,
  DEFAULT_CONFIG,
} from './types';

export * from './types';

/**
 * Main file processor class
 */
export class FileProcessor {
  private config: FileProcessorConfig;

  constructor(config: Partial<FileProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process a file and extract its text content
   */
  async process(request: FileProcessRequest): Promise<FileProcessResult> {
    const startTime = Date.now();
    const { file, fileName, mimeType } = request;
    const maxContentLength = request.maxContentLength || this.config.maxContentLength;

    // Validate file size
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    if (buffer.length > this.config.maxFileSizeBytes) {
      return {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size ${this.formatBytes(buffer.length)} exceeds maximum ${this.formatBytes(this.config.maxFileSizeBytes)}`,
        },
      };
    }

    // Validate MIME type
    if (!this.isSupported(mimeType)) {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_TYPE',
          message: `File type "${mimeType}" is not supported`,
          details: `Supported types: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, MD, CSV, JSON, images`,
        },
      };
    }

    try {
      // Extract content based on file type
      const { content, metadata, imageData } = await this.extractContent(buffer, mimeType, fileName);

      // Truncate if necessary
      let finalContent = content;
      let truncated = false;
      if (content.length > maxContentLength) {
        finalContent = content.substring(0, maxContentLength) + '\n\n[Content truncated...]';
        truncated = true;
      }

      const result: ProcessedFile = {
        id: crypto.randomUUID(),
        name: fileName,
        type: mimeType,
        size: buffer.length,
        extractedContent: finalContent,
        metadata: {
          ...metadata,
          wordCount: this.countWords(finalContent),
          characterCount: finalContent.length,
          truncated,
          originalLength: truncated ? content.length : undefined,
        },
        processingTimeMs: Date.now() - startTime,
        // Include base64 image data for vision model processing
        ...(imageData && { imageData }),
      };

      this.log(`Processed ${fileName}: ${this.formatBytes(buffer.length)}, ${result.metadata.wordCount} words, ${result.processingTimeMs}ms`);
      
      // Log imageData presence for debugging
      if (imageData) {
        this.log(`Image data included: ${imageData.substring(0, 50)}... (${imageData.length} chars)`);
      }

      return { success: true, data: result };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Failed to process ${fileName}: ${errorMessage}`, 'error');
      return {
        success: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: `Failed to extract content from ${fileName}`,
          details: errorMessage,
        },
      };
    }
  }

  /**
   * Check if a MIME type is supported
   */
  isSupported(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimeType);
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(fileName: string): string | null {
    const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!ext) return null;
    return FILE_EXTENSION_MAP[ext] || null;
  }

  /**
   * Extract content based on file type
   */
  private async extractContent(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<{ content: string; metadata: FileMetadata; imageData?: string }> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractPDF(buffer);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractDOCX(buffer);

      case 'application/msword':
        return this.extractDOC(buffer);

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return this.extractXLSX(buffer);

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      case 'application/vnd.ms-powerpoint':
        return this.extractPPTX(buffer);

      case 'text/plain':
      case 'text/markdown':
        return this.extractText(buffer);

      case 'text/csv':
        return this.extractCSV(buffer);

      case 'application/json':
        return this.extractJSON(buffer);

      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
        return this.extractImage(buffer, mimeType, fileName);

      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  /**
   * Extract text from PDF using pdf-parse v2 API
   */
  private async extractPDF(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      // pdf-parse v2 uses class-based API
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      
      try {
        const result = await parser.getText();
        return {
          content: result.text?.trim() || '',
          metadata: {
            pageCount: Array.isArray(result.pages) ? result.pages.length : undefined,
          },
        };
      } finally {
        // Always clean up the parser
        await parser.destroy();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FileProcessor] PDF extraction error:', errorMessage);
      throw new Error(`PDF extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Extract text from DOCX
   */
  private async extractDOCX(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        content: result.value?.trim() || '',
        metadata: {},
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FileProcessor] DOCX extraction error:', errorMessage);
      throw new Error(`DOCX extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Extract text from legacy DOC files using officeparser
   */
  private async extractDOC(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      const officeparser = await import('officeparser');
      const parseOffice = officeparser.parseOffice || officeparser.default?.parseOffice || officeparser.default;
      
      if (typeof parseOffice !== 'function') {
        throw new Error('officeparser.parseOffice is not a function');
      }
      
      const ast = await parseOffice(buffer);
      
      let text: string;
      if (ast && typeof ast.toText === 'function') {
        text = ast.toText();
      } else if (typeof ast === 'string') {
        text = ast;
      } else {
        text = JSON.stringify(ast);
      }
      
      return {
        content: (text || '').trim(),
        metadata: {},
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FileProcessor] DOC extraction error:', errorMessage);
      throw new Error(`DOC extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Extract text from XLSX/XLS
   */
  private async extractXLSX(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
      }

      return {
        content: sheets.join('\n\n'),
        metadata: {
          sheetCount: workbook.SheetNames.length,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FileProcessor] XLSX extraction error:', errorMessage);
      throw new Error(`XLSX extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Extract text from PPTX/PPT using officeparser v6 API
   */
  private async extractPPTX(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      // officeparser v6 returns an AST object, call toText() for plain text
      const officeparser = await import('officeparser');
      const parseOffice = officeparser.parseOffice || officeparser.default?.parseOffice || officeparser.default;
      
      if (typeof parseOffice !== 'function') {
        throw new Error('officeparser.parseOffice is not a function');
      }
      
      const ast = await parseOffice(buffer);
      
      // v6 returns AST with toText() method
      let text: string;
      if (ast && typeof ast.toText === 'function') {
        text = ast.toText();
      } else if (typeof ast === 'string') {
        // Fallback for older API or different return type
        text = ast;
      } else {
        text = JSON.stringify(ast);
      }
      
      // Try to get slide count from AST metadata if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const astAny = ast as any;
      const slideCount = astAny?.metadata?.slideCount || astAny?.slides?.length || undefined;
      
      return {
        content: (text || '').trim(),
        metadata: {
          slideCount,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FileProcessor] PPTX extraction error:', errorMessage);
      throw new Error(`PPTX extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Extract plain text
   */
  private async extractText(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    return {
      content: buffer.toString('utf-8').trim(),
      metadata: {},
    };
  }

  /**
   * Extract CSV as text
   */
  private async extractCSV(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    const text = buffer.toString('utf-8').trim();
    const lines = text.split('\n');
    return {
      content: text,
      metadata: {
        // Estimate row count
        pageCount: lines.length,
      },
    };
  }

  /**
   * Extract JSON as formatted text
   */
  private async extractJSON(buffer: Buffer): Promise<{ content: string; metadata: FileMetadata }> {
    const text = buffer.toString('utf-8');
    try {
      const parsed = JSON.parse(text);
      return {
        content: JSON.stringify(parsed, null, 2),
        metadata: {},
      };
    } catch {
      // If parsing fails, return raw text
      return {
        content: text.trim(),
        metadata: {},
      };
    }
  }

  /**
   * Handle image files - return base64 data for vision model processing
   */
  private async extractImage(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<{ content: string; metadata: FileMetadata; imageData?: string }> {
    // Convert image to base64 data URL for vision model
    const base64Data = buffer.toString('base64');
    const imageData = `data:${mimeType};base64,${base64Data}`;
    
    // Return a description placeholder - actual analysis happens via vision model
    const content = `[Image: ${fileName}]\nType: ${mimeType}\nSize: ${this.formatBytes(buffer.length)}\n\n[This image will be analyzed by the AI vision model]`;

    return {
      content,
      metadata: {
        // Would need sharp or similar to get actual dimensions
      },
      imageData,  // Base64 data URL for vision model
    };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Logging helper
   */
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (!this.config.verbose && level === 'info') return;
    const prefix = '[FileProcessor]';
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

// Export singleton instance
export const fileProcessor = new FileProcessor({ verbose: true });

// Export convenience function
export async function processFile(
  file: Buffer | ArrayBuffer,
  fileName: string,
  mimeType?: string
): Promise<FileProcessResult> {
  const processor = new FileProcessor({ verbose: true });
  const resolvedMimeType = mimeType || processor.getMimeType(fileName) || 'application/octet-stream';
  return processor.process({ file, fileName, mimeType: resolvedMimeType });
}
