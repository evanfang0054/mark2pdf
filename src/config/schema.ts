import { z } from 'zod';

const inputSchema = z.object({
  path: z.string().default('./public/md'),
  extensions: z.array(z.string()).default(['.md']),
  filters: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
});

const outputSchema = z.object({
  path: z.string().default('./dist/pdf'),
  createDirIfNotExist: z.boolean().default(true),
  maintainDirStructure: z.boolean().default(true),
  renamePattern: z.string().optional(),
});

const optionsSchema = z.object({
  concurrent: z.number().min(1).max(10).default(3),
  timeout: z.number().min(0).default(30000),
  format: z.enum(['A4', 'Letter', 'A3', 'A5']).default('A4'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  theme: z.string().optional(),
  toc: z.boolean().default(false),
  cssPath: z.string().optional(),
  watermark: z
    .object({
      text: z.string().optional(),
      opacity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  compression: z
    .object({
      enabled: z.boolean().default(false),
      quality: z.enum(['high', 'medium', 'low']).default('medium'),
    })
    .optional(),
  sort: z
    .object({
      enabled: z.boolean().default(false),
      method: z.enum(['name', 'date', 'size']).default('name'),
      direction: z.enum(['asc', 'desc']).default('asc'),
    })
    .optional(),
  overwrite: z.boolean().default(false),
});

const featuresSchema = z.object({
  incremental: z.boolean().default(true),
  retry: z.number().min(0).max(5).default(2),
  cache: z.boolean().default(true),
}).optional();

export const configSchema = z.object({
  input: inputSchema.optional().default({
    path: './public/md',
    extensions: ['.md'],
  }),
  output: outputSchema.optional().default({
    path: './dist/pdf',
    createDirIfNotExist: true,
    maintainDirStructure: true,
  }),
  options: optionsSchema.optional().default({
    concurrent: 3,
    timeout: 30000,
    format: 'A4',
    orientation: 'portrait',
    toc: false,
    overwrite: false,
  }),
  features: featuresSchema.optional().default({
    incremental: true,
    retry: 2,
    cache: true,
  }),
});

export type Mark2pdfConfig = z.infer<typeof configSchema>;

export const defaultConfig: Mark2pdfConfig = {
  input: {
    path: './public/md',
    extensions: ['.md'],
  },
  output: {
    path: './dist/pdf',
    createDirIfNotExist: true,
    maintainDirStructure: true,
  },
  options: {
    concurrent: 3,
    timeout: 30000,
    format: 'A4',
    orientation: 'portrait',
    toc: false,
    overwrite: false,
  },
  features: {
    incremental: true,
    retry: 2,
    cache: true,
  },
};
