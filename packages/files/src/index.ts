// The public entry point of @kete/files. Anything not exported here is internal.

export {
  assertValidKey,
  DEFAULT_DOWNLOAD_EXPIRY_SECONDS,
  DEFAULT_UPLOAD_EXPIRY_SECONDS,
  memoryStorage,
  type ObjectStorage,
  type PresignDownloadOptions,
  type PresignedRequest,
  type PresignUploadOptions,
} from './storage.js';
export { s3Storage, type S3StorageOptions } from './s3.js';
export {
  prepareImage,
  UnsafeFileError,
  type PreparedImage,
  type PrepareImageOptions,
} from './images.js';
export {
  EXCEL,
  POWERPOINT,
  readable,
  readDocument,
  WORD,
  type ReadDocument,
  type ReadKind,
  type ReadOptions,
  type Transcriber,
} from './read.js';
export {
  dayOf,
  numberOf,
  readSheets,
  readTable,
  SheetError,
  tabular,
  type ColumnType,
  type Sheet,
  type Table,
} from './sheets.js';
export { fillTemplate, TemplateError, templateFields } from './templates.js';
export {
  ConversionError,
  gotenbergConverter,
  pdfConverterFromEnv,
  type PdfConverter,
} from './pdf.js';
