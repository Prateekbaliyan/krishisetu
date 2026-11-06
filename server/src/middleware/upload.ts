import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.includes(rawExt)
      ? (rawExt === '.jpeg' ? '.jpg' : rawExt)
      : '.jpg';
    
    // Pure UUID-based filename prevents path traversal completely
    const safeFileName = `${file.fieldname}-${uuidv4()}${safeExt}`;
    cb(null, safeFileName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Invalid file type. Only standard JPEG, PNG, and WebP images are allowed.'));
  }
  cb(null, true);
};

export const multerUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter
}).fields([
  { name: 'scalePhoto', maxCount: 1 },
  { name: 'moisturePhoto', maxCount: 1 }
]);

/**
 * Validates actual binary magic bytes of an uploaded image file
 */
export function isValidImageMagicBytes(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buffer, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }
  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

/**
 * Middleware: wraps multer upload and performs deep magic-byte inspection
 */
export function uploadPhotos(req: Request, res: Response, next: NextFunction) {
  multerUpload(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File size exceeds maximum allowed limit of 5MB.' });
      }
      return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      for (const fieldName of ['scalePhoto', 'moisturePhoto']) {
        const fileList = files[fieldName];
        if (fileList && fileList[0]) {
          const filePath = fileList[0].path;
          if (!isValidImageMagicBytes(filePath)) {
            // Remove fraudulent file
            try { fs.unlinkSync(filePath); } catch {}
            return res.status(400).json({
              success: false,
              error: `Invalid image content detected in ${fieldName}. File content does not match genuine JPEG/PNG/WebP format.`
            });
          }
        }
      }
    }

    next();
  });
}
