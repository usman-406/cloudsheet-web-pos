import { SystemErrorLog } from '../types';

export interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  errorMessage?: string;
  fileSizeFormatted: string;
}

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf', 'csv', 'json']);
const DANGEROUS_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'msi', 'dll', 'so', 'bin', 'ps1']);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class SecurityUploadService {
  /**
   * Validates file upload before processing
   */
  static validateFileUpload(file: File): FileValidationResult {
    const filename = file.name || 'unnamed';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const sizeInMB = (((file?.size || 0) / (1024 * 1024)) || 0).toFixed(2);
    const sizeFormatted = `${sizeInMB} MB`;

    // 1. Check for dangerous executables
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return {
        isValid: false,
        sanitizedFilename: '',
        errorMessage: `Security Block: Executable file types (.${ext}) are strictly prohibited.`,
        fileSizeFormatted: sizeFormatted,
      };
    }

    // 2. Check for allowed extensions
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        isValid: false,
        sanitizedFilename: '',
        errorMessage: `Invalid File Type: Only images (.png, .jpg, .webp), documents (.pdf), and data files (.csv, .json) are allowed.`,
        fileSizeFormatted: sizeFormatted,
      };
    }

    // 3. Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        sanitizedFilename: '',
        errorMessage: `File Size Exceeded: File size (${sizeFormatted}) exceeds maximum limit of 5.0 MB.`,
        fileSizeFormatted: sizeFormatted,
      };
    }

    // Generate safe obfuscated filename
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const datePrefix = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const safeName = `bc_upload_${datePrefix}_${randomSuffix}.${ext}`;

    return {
      isValid: true,
      sanitizedFilename: safeName,
      fileSizeFormatted: sizeFormatted,
    };
  }
}
