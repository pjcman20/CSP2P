// Input validation schemas using Zod
// Prevents XSS, injection, and data corruption attacks

import { z } from 'npm:zod@3';

// ============================================
// ITEM VALIDATION
// ============================================

export const ItemSchema = z.object({
  name: z.string()
    .min(1, 'Item name is required')
    .max(200, 'Item name too long (max 200 characters)')
    .trim(),
  
  wear: z.enum([
    'Factory New',
    'Minimal Wear', 
    'Field-Tested',
    'Well-Worn',
    'Battle-Scarred',
    'ANY'
  ]).optional(),
  
  price: z.number()
    .min(0, 'Price cannot be negative')
    .max(1000000, 'Price too high (max $1,000,000)')
    .optional(),
  
  image: z.string()
    .max(500, 'Image URL too long')
    .optional()
    .transform(val => {
      // If empty string or undefined, return undefined
      if (!val || val.trim() === '') return undefined;
      // Allow figma:asset URLs (for placeholder images)
      if (val.startsWith('figma:asset/')) return val;
      // If it's a valid HTTP/HTTPS URL, return it
      try {
        new URL(val);
        return val;
      } catch {
        // If it's not a valid URL, return undefined
        return undefined;
      }
    }),
  
  rarity: z.string()
    .max(50, 'Rarity too long')
    .optional(),
  
  // Allow additional fields for flexibility
}).passthrough();

// ============================================
// OFFER VALIDATION
// ============================================

export const CreateOfferSchema = z.object({
  offering: z.array(ItemSchema)
    .min(1, 'Must offer at least one item')
    .max(50, 'Cannot offer more than 50 items'),
  
  seeking: z.array(ItemSchema)
    .min(1, 'Must seek at least one item')
    .max(50, 'Cannot seek more than 50 items'),
  
  notes: z.string()
    .max(5000, 'Notes too long (max 5000 characters)')
    .optional()
    .transform(val => val?.trim() || undefined),
});

export const UpdateOfferSchema = z.object({
  offering: z.array(ItemSchema)
    .min(1, 'Must offer at least one item')
    .max(50, 'Cannot offer more than 50 items')
    .optional(),
  
  seeking: z.array(ItemSchema)
    .min(1, 'Must seek at least one item')
    .max(50, 'Cannot seek more than 50 items')
    .optional(),
  
  notes: z.string()
    .max(5000, 'Notes too long (max 5000 characters)')
    .optional()
    .transform(val => val?.trim() || undefined),
  
  status: z.enum(['active', 'completed', 'cancelled', 'expired'])
    .optional(),
}).refine(
  data => data.offering || data.seeking || data.notes || data.status,
  { message: 'Must update at least one field' }
);

// ============================================
// TRADE URL VALIDATION
// ============================================

export const TradeUrlSchema = z.string()
  .regex(
    /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+$/,
    'Invalid Steam trade URL format. Must be: https://steamcommunity.com/tradeoffer/new/?partner=123456&token=abc123'
  )
  .max(500, 'Trade URL too long');

export const UpdateProfileSchema = z.object({
  tradeUrl: TradeUrlSchema,
});

// ============================================
// TRADE REQUEST VALIDATION
// ============================================

export const CreateTradeRequestSchema = z.object({
  offerId: z.string()
    .uuid('Invalid offer ID format'),
  
  message: z.string()
    .max(2000, 'Message too long (max 2000 characters)')
    .optional()
    .transform(val => val?.trim() || undefined),
});

export const UpdateTradeRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'completed', 'cancelled']),
});

// ============================================
// REPUTATION VALIDATION
// ============================================

export const VoteReputationSchema = z.object({
  targetSteamId: z.string()
    .regex(/^\d{17}$/, 'Invalid Steam ID format (must be 17 digits)'),
  
  voteType: z.enum(['completed', 'reversed']),
});

// ============================================
// PAGINATION VALIDATION
// ============================================

export const PaginationSchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, 'Page must be greater than 0')
    .default('1'),
  
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .default('50'),
  
  status: z.enum(['active', 'completed', 'cancelled', 'expired', 'all'])
    .optional()
    .default('active'),
  
  sortBy: z.enum(['created_at', 'views', 'updated_at'])
    .optional()
    .default('created_at'),
  
  sortOrder: z.enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

// ============================================
// VALIDATION HELPER FUNCTIONS
// ============================================

/**
 * Validate data against a schema and return validated data or throw error
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into user-friendly messages
      const messages = error.errors.map(err => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
      });
      
      throw new ValidationError(messages.join('; '));
    }
    throw error;
  }
}

/**
 * Validate data and return result object instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
  
  return { success: false, errors };
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================
// SANITIZATION (for HTML content)
// ============================================

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes all HTML tags and dangerous content
 */
export function sanitizeHtml(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  
  // Simple sanitization: remove all HTML tags
  // For more complex needs, use DOMPurify (but need to run in browser or with jsdom)
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove objects
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove embeds
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers (onclick, etc.)
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:text\/html/gi, '') // Remove data: URIs
    .trim();
}

/**
 * Sanitize all string fields in an object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    const value = sanitized[key];
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeHtml(value) as any;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'object' && item !== null 
          ? sanitizeObject(item)
          : typeof item === 'string'
          ? sanitizeHtml(item)
          : item
      ) as any;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    }
  }
  
  return sanitized;
}

// ============================================
// RATE LIMITING VALIDATION
// ============================================

export const RateLimitConfig = {
  // Offer operations
  CREATE_OFFER: { maxRequests: 10, windowSeconds: 3600 }, // 10 per hour
  UPDATE_OFFER: { maxRequests: 20, windowSeconds: 3600 }, // 20 per hour
  DELETE_OFFER: { maxRequests: 20, windowSeconds: 3600 }, // 20 per hour
  
  // Trade requests
  CREATE_REQUEST: { maxRequests: 20, windowSeconds: 3600 }, // 20 per hour
  UPDATE_REQUEST: { maxRequests: 50, windowSeconds: 3600 }, // 50 per hour
  
  // Reputation
  VOTE_REPUTATION: { maxRequests: 50, windowSeconds: 86400 }, // 50 per day
  
  // General API
  GENERAL_API: { maxRequests: 100, windowSeconds: 60 }, // 100 per minute
};

// ============================================
// EXPORTS
// ============================================

export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;
export type UpdateOfferInput = z.infer<typeof UpdateOfferSchema>;
export type CreateTradeRequestInput = z.infer<typeof CreateTradeRequestSchema>;
export type UpdateTradeRequestInput = z.infer<typeof UpdateTradeRequestSchema>;
export type VoteReputationInput = z.infer<typeof VoteReputationSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type Item = z.infer<typeof ItemSchema>;